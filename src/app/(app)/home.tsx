import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '@/api';
import { isApiErrorCode } from '@/api/errors';
import { checkZone, listCategories, type Category } from '@/api/endpoints/rides';
import { keys, useActiveRide, useMe, useWallet } from '@/features/account/queries';
import { useBooking } from '@/features/booking/store';
import { addressLabel, currentFix, LocationTimeout, roughTrip, useLastFix } from '@/features/location/location';
import { savedOfKind, usePlaces, type SavedPlace } from '@/features/places/places-store';
import { currentLanguage, errorMessage } from '@/i18n';
import { track } from '@/lib/analytics';
import { formatDuration, formatMoney } from '@/lib/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Avatar, Banner, Button, Chip, Icon, OfflineBar, Pressable, Row, SelectableCard, Skeleton, Text, VehicleIcon } from '@/ui';

// Home — choose vehicle (docs/spec/03-screens.md §7.6, mockup 6).
export default function Home() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lang = currentLanguage();
  const me = useMe();
  const wallet = useWallet();
  const activeRide = useActiveRide();
  const setFix = useLastFix((s) => s.setFix);
  const booking = useBooking();
  const saved = usePlaces((s) => s.saved);

  // Pickup = current position unless the passenger moved the pin (setPickup ignores GPS once pinned).
  const position = useQuery({
    queryKey: ['position'],
    queryFn: async () => {
      const next = await currentFix();
      const label = await addressLabel(next.lat, next.lng);
      return { ...next, label: label?.title ?? null };
    },
    staleTime: 30_000,
    retry: false,
  });
  const setPickup = booking.setPickup;
  useEffect(() => {
    const p = position.data;
    if (!p) return;
    setFix(p);
    setPickup({ lat: p.lat, lng: p.lng, label: p.label ?? t('home.currentLocation') }, false);
  }, [position.data, setFix, setPickup, t]);

  const locating = position.isFetching && !position.data;
  const locError = position.error ? (position.error instanceof LocationTimeout ? t('home.gpsTimeout') : t('home.gpsFailed')) : null;
  const locate = () => void position.refetch();

  const pickup = booking.pickup;
  const zone = useQuery({
    queryKey: pickup ? keys.zone(pickup.lat, pickup.lng) : ['zone', 'none'],
    queryFn: () => checkZone(api(), pickup!),
    enabled: !!pickup,
    staleTime: 5 * 60_000,
  });
  const categories = useQuery({
    queryKey: pickup ? keys.categories(pickup.lat, pickup.lng) : ['categories', 'none'],
    queryFn: () => listCategories(api(), pickup!),
    enabled: !!pickup && zone.data?.in_service_area === true,
    staleTime: 60_000,
  });

  // Outside every zone: explain instead of showing empty choices.
  const outside = zone.data?.in_service_area === false || isApiErrorCode(categories.error, 'OUT_OF_SERVICE_AREA');
  useEffect(() => {
    if (outside) router.replace({ pathname: '/out-of-area', params: { area: pickup?.label ?? '' } });
  }, [outside, pickup?.label]);

  const list = useMemo(() => categories.data ?? [], [categories.data]);
  const selected = list.find((c) => c.id === booking.categoryId) ?? list[0];
  useEffect(() => {
    if (selected && selected.id !== booking.categoryId) booking.setCategory(selected.id);
  }, [selected, booking]);

  // "Fastest" only when more than one type has a live ETA to compare.
  const timed = list.filter((c) => c.pickup_eta_s != null);
  const fastestId = timed.length > 1 ? timed.reduce((a, b) => (b.pickup_eta_s! < a.pickup_eta_s! ? b : a)).id : null;
  const name = (c: Category) => (lang === 'bn' && c.name_bn ? c.name_bn : c.name);
  const firstName = me.data?.full_name?.split(' ')[0] ?? '';
  const home = savedOfKind(saved, 'home');
  const office = savedOfKind(saved, 'office');

  const goQuick = (place: SavedPlace | undefined, kind: 'home' | 'office') => {
    if (!place) return router.push({ pathname: '/pin', params: { mode: 'save', kind } });
    booking.setDestination({ lat: place.lat, lng: place.lng, label: place.label });
    track('destination_selected', { source: kind === 'home' ? 'quick_home' : 'quick_office' });
    router.push('/confirm');
  };
  const quickMinutes = (place?: SavedPlace) => (place && pickup ? formatDuration(roughTrip(pickup, place).seconds, lang) : t('home.set'));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <OfflineBar />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={false}
            tintColor={colors.accent}
            onRefresh={() => {
              locate();
              void categories.refetch();
              void wallet.refetch();
            }}
          />
        }>
        <View style={[styles.hero, { backgroundColor: colors.hero, paddingTop: insets.top + space[4] }]}>
          <Row style={styles.between}>
            <Pressable
              onPress={() => router.push({ pathname: '/pin', params: { mode: 'pickup' } })}
              accessibilityRole="button"
              accessibilityLabel={t('home.changePickup', { place: pickup?.label ?? '' })}
              style={styles.pickup}>
              <Row gap={2}>
                <View style={[styles.dot, { backgroundColor: locError ? colors.warning : colors.accent }]} />
                <Text variant="caption" color="onHeroMuted">
                  {locating ? t('home.locating') : locError ? t('home.locationProblem') : t('home.locationOn')}
                </Text>
              </Row>
              <Row gap={1}>
                {pickup ? (
                  <Text variant="bodyStrong" color="onHero" numberOfLines={1} style={styles.shrink}>
                    {pickup.label}
                  </Text>
                ) : (
                  <Skeleton width={160} height={18} />
                )}
                <Icon name="chevron-down" size={16} color="onHero" />
              </Row>
            </Pressable>
            <Avatar name={me.data?.full_name} label={t('home.account')} onPress={() => router.push('/account')} />
          </Row>
          <Text variant="title" color="onHero" accessibilityRole="header">
            {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingNoName')}
          </Text>
        </View>

        <View style={styles.body}>
          <Row style={styles.steps}>
            <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
              <Text variant="caption" color="onPrimary" weight="700">
                1
              </Text>
            </View>
            <Text variant="label">{t('home.stepVehicle')}</Text>
            <View style={[styles.stepLine, { backgroundColor: colors.border }]} />
            <Text variant="label" color="textMuted">
              {t('home.stepDestination')}
            </Text>
          </Row>

          {activeRide.data ? (
            <Banner
              tone="info"
              icon="navigation"
              title={t('home.activeRide')}
              body={t('home.activeRideBody')}
              action={{ label: t('home.return'), onPress: () => router.push({ pathname: '/ride/[id]', params: { id: activeRide.data!.id } }) }}
            />
          ) : null}
          {wallet.data && Number(wallet.data.outstanding_fee) > 0 ? (
            <Banner tone="warning" body={t('home.feeOwed', { amount: formatMoney(wallet.data.outstanding_fee) })} />
          ) : null}
          {locError ? (
            <Banner
              tone="warning"
              body={locError}
              action={{ label: t('home.setOnMap'), onPress: () => router.push({ pathname: '/pin', params: { mode: 'pickup' } }) }}
            />
          ) : null}
          {categories.error && !outside ? (
            <Banner tone="danger" body={errorMessage(categories.error)} action={{ label: t('common.retry'), onPress: () => void categories.refetch() }} />
          ) : null}

          {categories.isPending || !pickup ? (
            <View style={styles.grid}>
              <Skeleton height={300} rounded={radius.lg} style={styles.big} />
              <View style={styles.column}>
                <Skeleton height={144} rounded={radius.lg} />
                <Skeleton height={144} rounded={radius.lg} />
              </View>
            </View>
          ) : (
            <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={t('home.stepVehicle')}>
              {list[0] ? (
                <VehicleCard category={list[0]} label={name(list[0])} selected={selected?.id === list[0].id} big={list.length > 1} fastest={fastestId === list[0].id} />
              ) : null}
              {list.length > 1 ? (
                <View style={styles.column}>
                  {list.slice(1).map((c) => (
                    <VehicleCard key={c.id} category={c} label={name(c)} selected={selected?.id === c.id} fastest={fastestId === c.id} />
                  ))}
                </View>
              ) : null}
            </View>
          )}

          {selected?.description ? <Banner tone="neutral" icon="info" body={selected.description} /> : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space[3] }]}>
        <Button
          testID="next-where-to"
          label={t('home.next')}
          rightIcon="arrow-right"
          disabled={!selected || !pickup}
          onPress={() => router.push('/plan')}
        />
        <Row gap={3}>
          <Chip icon="home" label={`${t('places.home')} · ${quickMinutes(home)}`} onPress={() => goQuick(home, 'home')} />
          <Chip icon="briefcase" label={`${t('places.office')} · ${quickMinutes(office)}`} onPress={() => goQuick(office, 'office')} />
        </Row>
      </View>
    </View>
  );
}

function VehicleCard({
  category,
  label,
  selected,
  big = false,
  fastest = false,
}: {
  category: Category;
  label: string;
  selected: boolean;
  big?: boolean;
  fastest?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = currentLanguage();
  const setCategory = useBooking((s) => s.setCategory);
  const fg = selected ? 'onHero' : 'text';
  const seats = t('home.seats', { count: category.passenger_capacity });
  // Live data from rider-admin (gap B11): nearby drivers and the nearest one's ETA.
  const busy = category.available_drivers === 0;
  const parts = [
    category.pickup_eta_s != null ? formatDuration(category.pickup_eta_s, lang) : null,
    seats,
    category.available_drivers ? t('home.nearby', { count: category.available_drivers }) : null,
  ].filter(Boolean);
  const detail = busy ? `${seats} · ${t('home.busy')}` : parts.join(' · ');
  return (
    <SelectableCard
      testID={`vehicle-${category.code}`}
      selected={selected}
      onPress={() => {
        setCategory(category.id);
        track('category_selected', { category: category.code });
      }}
      accessibilityLabel={[label, fastest ? t('home.fastest') : null, detail].filter(Boolean).join(', ')}
      style={[styles.card, big ? styles.big : styles.small]}>
      {fastest ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text variant="caption" color="onAccent" weight="700">
            {t('home.fastest')}
          </Text>
        </View>
      ) : null}
      <VehicleIcon code={category.code} size={big ? 72 : 36} color={selected ? 'accent' : 'text'} />
      <View>
        <Text variant={big ? 'title' : 'heading'} color={fg}>
          {label}
        </Text>
        <Text variant="caption" color={busy ? (selected ? 'onHero' : 'warningText') : selected ? 'onHeroMuted' : 'textMuted'}>
          {detail}
        </Text>
      </View>
    </SelectableCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingBottom: space[6] },
  hero: { paddingHorizontal: space[5], paddingBottom: space[8], gap: space[4], borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  between: { justifyContent: 'space-between' },
  pickup: { flex: 1, gap: space[1], paddingRight: space[3] },
  shrink: { flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  body: { paddingHorizontal: space[4], gap: space[4], marginTop: space[4] },
  steps: { gap: space[2] },
  stepBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, height: 2 },
  grid: { flexDirection: 'row', gap: space[3] },
  column: { flex: 1, gap: space[3] },
  card: { justifyContent: 'space-between', gap: space[3] },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 2 },
  big: { flex: 1.15, minHeight: 300 },
  small: { flex: 1, minHeight: 144 },
  footer: { paddingHorizontal: space[4], paddingTop: space[3], gap: space[3] },
});
