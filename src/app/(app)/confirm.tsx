import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api, intents } from '@/api';
import { isApiErrorCode } from '@/api/errors';
import { isFlagOn } from '@/api/endpoints/account';
import { createQuote, listCategories, requestRide, type Quote } from '@/api/endpoints/rides';
import { keys, refreshAfterRideChange, useActiveRide, useClientConfig, useWallet } from '@/features/account/queries';
import { quoteLines } from '@/features/booking/fare-lines';
import { useBooking } from '@/features/booking/store';
import { askPermissionInContext, registerForPush } from '@/features/push/push';
import { RideMap } from '@/features/map/RideMap';
import { currentLanguage, errorMessage } from '@/i18n';
import { formatDistance, formatDuration, formatMoney } from '@/lib/format';
import { decodePolyline } from '@/lib/polyline';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { elevation, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import {
  Banner,
  Button,
  Chip,
  FareBreakdown,
  Icon,
  Pressable,
  Row,
  Sheet,
  Skeleton,
  Text,
  TextField,
  useToast,
  VehicleIcon,
  type SheetHandle,
} from '@/ui';

// Confirm ride — fare quote (docs/spec/03-screens.md §7.9). The fare shown is always the server's quote; it is
// refreshed silently when it expires, and a changed price needs a fresh tap.
export default function Confirm() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();
  const lang = currentLanguage();
  const booking = useBooking();
  const config = useClientConfig();
  const wallet = useWallet();
  const activeRide = useActiveRide();
  const breakdownSheet = useRef<SheetHandle>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [promo, setPromo] = useState('');
  const [promoOpen, setPromoOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!booking.pickupNote);
  const [changedFrom, setChangedFrom] = useState<string | null>(null);
  const lastFare = useRef<string | null>(null);

  const { pickup, destination, categoryId } = booking;
  const ready = !!pickup && !!destination && !!categoryId;

  const categories = useQuery({
    queryKey: pickup ? keys.categories(pickup.lat, pickup.lng) : ['categories', 'none'],
    queryFn: () => listCategories(api(), pickup!),
    enabled: !!pickup,
    staleTime: 60_000,
  });
  const category = categories.data?.find((c) => c.id === categoryId);

  const quote = useQuery({
    queryKey: ['quote', categoryId, pickup?.lat, pickup?.lng, destination?.lat, destination?.lng],
    enabled: ready,
    gcTime: 0,
    staleTime: Infinity,
    // Each quote is a new intent: a fresh key, so an expired quote is never replayed.
    queryFn: () => createQuote(api(), { categoryId: categoryId!, pickup: pickup!, destination: destination! }, randomUUID()),
  });

  // Re-quote silently at expiry; flag a price change so the passenger must look before requesting.
  const refetchQuote = quote.refetch;
  useEffect(() => {
    const q = quote.data;
    if (!q) return;
    if (lastFare.current && lastFare.current !== q.estimated_fare) {
      setChangedFrom(lastFare.current);
      track('quote_changed', { change_pct: ((Number(q.estimated_fare) - Number(lastFare.current)) / Number(lastFare.current)) * 100 });
    } else if (!lastFare.current) {
      track('quote_shown', { surge: q.surge_multiplier, distance_km: q.distance_m / 1000, drivers: q.available_drivers ?? -1 });
    }
    lastFare.current = q.estimated_fare;
    const ms = new Date(q.expires_at).getTime() - Date.now() - 2_000;
    const timer = setTimeout(() => void refetchQuote(), Math.max(1_000, ms));
    return () => clearTimeout(timer);
  }, [quote.data, refetchQuote]);

  // Missing draft (e.g. restored app): back to the start.
  useEffect(() => {
    if (!ready) router.replace('/home');
  }, [ready]);

  const methods = isFlagOn(config.data, 'digital_payments') ? (config.data?.settings?.payment_methods ?? ['cash']) : ['cash'];
  const promosOn = isFlagOn(config.data, 'promo_codes');
  const owed = wallet.data && Number(wallet.data.outstanding_fee) > 0 ? wallet.data.outstanding_fee : null;

  const request = async (q: Quote) => {
    if (requesting) return;
    setRequesting(true);
    setRequestError(null);
    haptic('requestSent');
    try {
      const code = promo.trim().toUpperCase();
      // The promotion code travels with the request (gap B12); a bad code is reported but never blocks the ride.
      const ride = await intents().run(`ride.request:${q.id}:${code}`, (key) =>
        requestRide(api(), { quoteId: q.id, paymentMethod: booking.paymentMethod, pickupNote: booking.pickupNote, promoCode: code || undefined }, key),
      );
      if (ride.promo?.applied && ride.promo.estimated_discount) {
        toast({ message: t('confirm.promoApplied', { amount: formatMoney(ride.promo.estimated_discount) }), tone: 'success' });
      } else if (ride.promo && !ride.promo.applied) {
        toast({ message: t(`errors.${ride.promo.error ?? 'PROMO_INVALID'}`, { defaultValue: t('errors.PROMO_INVALID') }), tone: 'danger' });
      }
      refreshAfterRideChange(queryClient, ride.id);
      queryClient.setQueryData(keys.ride(ride.id), ride);
      // The moment a push is obviously useful: "know when your driver arrives" (spec §10.1).
      track('ride_requested', { category: category?.code ?? 'unknown', has_note: !!booking.pickupNote.trim(), has_promo: !!promo.trim() });
      void askPermissionInContext().then((granted) => {
        track('push_permission_result', { granted });
        if (granted) void registerForPush();
      });
      router.replace({ pathname: '/ride/[id]', params: { id: ride.id } });
    } catch (error) {
      haptic('error');
      if (isApiErrorCode(error, 'QUOTE_EXPIRED')) {
        void quote.refetch();
        setRequestError(t('errors.QUOTE_EXPIRED'));
      } else if (isApiErrorCode(error, 'ACTIVE_REQUEST_EXISTS')) {
        const existing = (await activeRide.refetch()).data;
        if (existing) router.replace({ pathname: '/ride/[id]', params: { id: existing.id } });
        else setRequestError(errorMessage(error));
      } else {
        setRequestError(errorMessage(error));
      }
    } finally {
      setRequesting(false);
    }
  };

  const q = quote.data;
  const routePoints = useMemo(() => decodePolyline(q?.route_polyline), [q?.route_polyline]);
  const unavailable = isApiErrorCode(quote.error, 'PRICING_UNAVAILABLE', 'OUT_OF_SERVICE_AREA');
  const vehicleName = category ? (lang === 'bn' && category.name_bn ? category.name_bn : category.name) : '';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.map}>
        <RideMap pickup={pickup} destination={destination} route routePoints={routePoints} fitPadding={{ top: insets.top + 80, bottom: 60, left: 48, right: 48 }} style={StyleSheet.absoluteFill} />
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('ui.back')}
          style={[styles.back, elevation.card, { top: insets.top + space[3], backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
          <Icon name="chevron-left" size={22} />
        </Pressable>
      </View>

      <View style={[styles.sheet, elevation.sheet, { backgroundColor: colors.background, shadowColor: colors.shadow }]}>
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Row style={styles.between}>
            <Row gap={3} style={styles.flex}>
              <View style={[styles.vehicle, { backgroundColor: colors.surfaceMuted }]}>
                <VehicleIcon code={category?.code ?? 'car'} size={30} />
              </View>
              <View style={styles.flex}>
                <Text variant="heading">{vehicleName || ' '}</Text>
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {destination?.label}
                </Text>
              </View>
            </Row>
            <Chip label={t('confirm.change')} onPress={() => router.dismissTo('/home')} />
          </Row>

          {quote.isPending ? (
            <View style={styles.gap}>
              <Skeleton height={44} width="50%" />
              <Skeleton height={18} width="80%" />
            </View>
          ) : q ? (
            <View style={styles.gap}>
              <Row style={styles.between}>
                <View>
                  <Text variant="display" tabular testID="quote-fare">
                    {formatMoney(q.estimated_fare)}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {t('confirm.estimated')}
                  </Text>
                </View>
                <Button label={t('confirm.breakdown')} variant="ghost" size="md" fullWidth={false} rightIcon="chevron-right" onPress={() => breakdownSheet.current?.present()} />
              </Row>
              <Row gap={2} style={styles.wrap}>
                {q.pickup_eta_s != null ? <Chip icon="clock" label={t('confirm.driverEta', { time: formatDuration(q.pickup_eta_s, lang) })} /> : null}
                <Chip icon="navigation" label={`${formatDistance(q.distance_m, lang)} · ${formatDuration(q.duration_s, lang)}`} />
              </Row>
              {changedFrom ? (
                <Banner tone="warning" title={t('confirm.priceChanged')} body={t('confirm.priceChangedBody', { from: formatMoney(changedFrom), to: formatMoney(q.estimated_fare) })} />
              ) : null}
              {q.surge_multiplier > 1 ? <Banner tone="warning" icon="trending-up" body={t('confirm.surge', { x: q.surge_multiplier.toFixed(1) })} /> : null}
              {q.available_drivers === 0 ? <Banner tone="info" body={t('confirm.noDrivers')} /> : null}
              {owed ? <Banner tone="warning" body={t('confirm.feeOwed', { amount: formatMoney(owed) })} /> : null}
            </View>
          ) : quote.error ? (
            <Banner
              tone="danger"
              body={unavailable ? t('confirm.unavailable') : errorMessage(quote.error)}
              action={unavailable ? { label: t('confirm.change'), onPress: () => router.back() } : { label: t('common.retry'), onPress: () => void quote.refetch() }}
            />
          ) : null}

          <View style={[styles.options, { backgroundColor: colors.surface }]}>
            <OptionRow icon="dollar-sign" title={t('confirm.payment')} value={t(`confirm.methods.${methods.length === 1 ? 'cash' : booking.paymentMethod}`)} />
            {promosOn ? (
              promoOpen ? (
                <View style={styles.inline}>
                  <TextField
                    label={t('confirm.promoLabel')}
                    value={promo}
                    onChangeText={(v) => setPromo(v.toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={20}
                    helper={t('confirm.promoHelp')}
                  />
                </View>
              ) : (
                <OptionRow icon="tag" title={t('confirm.addPromo')} onPress={() => setPromoOpen(true)} />
              )
            ) : null}
            {noteOpen ? (
              <View style={styles.inline}>
                <TextField
                  label={t('confirm.noteLabel')}
                  placeholder={t('pin.notePlaceholder')}
                  value={booking.pickupNote}
                  onChangeText={booking.setPickupNote}
                  maxLength={300}
                />
              </View>
            ) : (
              <OptionRow icon="message-square" title={t('confirm.addNote')} onPress={() => setNoteOpen(true)} />
            )}
          </View>

          {requestError ? <Banner tone="danger" body={requestError} /> : null}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + space[3] }]}>
          <Button
            testID="request-ride"
            label={t('confirm.request', { vehicle: vehicleName })}
            onPress={() => q && void request(q)}
            loading={requesting}
            disabled={!q || quote.isFetching}
          />
        </View>
      </View>

      <Sheet ref={breakdownSheet} title={t('confirm.breakdownTitle')}>
        {q ? <FareBreakdown lines={quoteLines(q.breakdown)} /> : null}
        <Text variant="caption" color="textMuted">
          {t('confirm.whatChanges')}
        </Text>
        <Button label={t('common.close')} variant="secondary" onPress={() => breakdownSheet.current?.dismiss()} />
      </Sheet>
    </View>
  );
}

function OptionRow({ icon, title, value, onPress }: { icon: 'dollar-sign' | 'tag' | 'message-square'; title: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} scaleOnPress={false} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={value ? `${title}, ${value}` : title} style={styles.option}>
      <Icon name={icon} size={18} color="textMuted" />
      <Text style={styles.flex}>{title}</Text>
      {value ? (
        <Text variant="bodyStrong">{value}</Text>
      ) : (
        <Icon name="plus" size={18} color="textMuted" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  map: { height: '38%' },
  back: { position: 'absolute', left: space[4], width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, marginTop: -space[6], borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' },
  sheetContent: { padding: space[5], gap: space[4] },
  between: { justifyContent: 'space-between' },
  vehicle: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: space[3] },
  wrap: { flexWrap: 'wrap' },
  options: { borderRadius: radius.lg, paddingVertical: space[1] },
  option: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52, paddingHorizontal: space[4] },
  inline: { padding: space[3] },
  footer: { paddingHorizontal: space[4], paddingTop: space[3] },
});
