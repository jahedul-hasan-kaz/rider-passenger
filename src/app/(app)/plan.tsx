import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Place } from '@/api/endpoints/rides';
import { useBooking } from '@/features/booking/store';
import { roughTrip } from '@/features/location/location';
import { savedOfKind, usePlaces, type SavedPlace } from '@/features/places/places-store';
import { highlight, localMatches, remotePlaces, type PlaceResult } from '@/features/places/search';
import { currentLanguage } from '@/i18n';
import { formatDistance, formatDuration } from '@/lib/format';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { useOnline } from '@/lib/use-online';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Banner, Button, Card, Chip, HeroHeader, Icon, Pressable, Row, Screen, Skeleton, Text, TextField } from '@/ui';

// Plan your ride — destination (docs/spec/03-screens.md §7.7, mockup 7). Choosing a row goes straight to Confirm.
export default function Plan() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = currentLanguage();
  const online = useOnline();
  const booking = useBooking();
  const { saved, recent, pushRecent } = usePlaces();
  const [editing, setEditing] = useState<'destination' | 'pickup'>('destination');
  const [query, setQuery] = useState('');
  // Results are kept with the query they answer, so stale ones are never shown and nothing resets in an effect.
  const [found, setFound] = useState<{ q: string; rows: PlaceResult[] }>({ q: '', rows: [] });
  const input = useRef<TextInputInstance>(null);

  // Debounced search (300 ms, ≥ 2 characters); a newer query cancels the older one.
  const trimmed = query.trim();
  // Search is biased to the pickup; rounded so GPS jitter doesn't restart it.
  const nearLat = booking.pickup ? Math.round(booking.pickup.lat * 1000) / 1000 : undefined;
  const nearLng = booking.pickup ? Math.round(booking.pickup.lng * 1000) / 1000 : undefined;
  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const remote = await remotePlaces(trimmed, nearLat !== undefined && nearLng !== undefined ? { lat: nearLat, lng: nearLng } : null, controller.signal);
      if (controller.signal.aborted) return;
      setFound({ q: trimmed, rows: [...localMatches(trimmed, saved, recent), ...remote] });
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed, saved, recent, nearLat, nearLng]);
  const searching = trimmed.length >= 2 && found.q !== trimmed;
  const results = found.q === trimmed ? found.rows : localMatches(trimmed, saved, recent);

  const choose = (place: Place & { subtitle?: string; source?: string }) => {
    haptic('selection');
    if (editing === 'pickup') {
      booking.setPickup({ lat: place.lat, lng: place.lng, label: place.label });
      setEditing('destination');
      setQuery('');
      input.current?.focus();
      return;
    }
    booking.setDestination({ lat: place.lat, lng: place.lng, label: place.label });
    track('destination_selected', { source: place.source ?? 'saved_tile' });
    void pushRecent({ lat: place.lat, lng: place.lng, label: place.label, subtitle: place.subtitle });
    router.push('/confirm');
  };

  const pickup = booking.pickup;
  const meta = (p: Place) => {
    if (!pickup) return undefined;
    const trip = roughTrip(pickup, p);
    return `${formatDistance(trip.meters, lang)} · ~${formatDuration(trip.seconds, lang)}`;
  };

  const home = savedOfKind(saved, 'home');
  const office = savedOfKind(saved, 'office');
  const showRecent = query.trim().length < 2;
  const rows: PlaceResult[] = showRecent
    ? recent.map((r) => ({ ...r, title: r.label ?? '', source: 'recent' as const }))
    : results;

  return (
    <Screen
      hero={
        <HeroHeader
          title={t('plan.title')}
          onBack={() => router.back()}
          right={<Chip icon="edit-2" label={t('plan.changeVehicle')} onPress={() => router.back()} />}
          overlap={space[2]}>
          <View style={styles.fields}>
            <View style={styles.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.from, { borderColor: colors.accent }]} />
              <View style={[styles.dash, { borderColor: colors.onHeroMuted }]} />
              <View style={[styles.to, { backgroundColor: colors.danger }]} />
            </View>
            <View style={styles.inputs}>
              <Pressable
                onPress={() => {
                  setEditing('pickup');
                  setQuery('');
                  input.current?.focus();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('plan.fromLabel', { place: pickup?.label ?? '' })}
                style={[styles.fromBox, { backgroundColor: colors.surfaceSelected, borderColor: editing === 'pickup' ? colors.accent : 'transparent' }]}>
                <Text variant="caption" color="onHeroMuted" weight="700">
                  {t('plan.from')}
                </Text>
                <Text variant="bodyStrong" color="onHero" numberOfLines={1} style={styles.flex}>
                  {pickup?.label ?? t('home.currentLocation')}
                </Text>
              </Pressable>
              <TextField
                ref={input}
                testID="destination-input"
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder={editing === 'pickup' ? t('plan.searchPickup') : t('plan.searchDestination')}
                accessibilityLabel={editing === 'pickup' ? t('plan.searchPickup') : t('plan.searchDestination')}
                left={
                  <Text variant="caption" color="textMuted" weight="700">
                    {editing === 'pickup' ? t('plan.from') : t('plan.to')}
                  </Text>
                }
                right={
                  query ? (
                    <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('plan.clear')}>
                      <Icon name="x" size={18} color="textMuted" />
                    </Pressable>
                  ) : null
                }
                returnKeyType="search"
              />
            </View>
            <Pressable
              onPress={() => booking.swap()}
              disabled={!booking.destination}
              accessibilityRole="button"
              accessibilityLabel={t('plan.swap')}
              style={[styles.swap, { borderColor: colors.onHeroMuted, opacity: booking.destination ? 1 : 0.4 }]}>
              <Icon name="repeat" size={18} color="onHero" />
            </Pressable>
          </View>
        </HeroHeader>
      }>
      <Row gap={3}>
        <SavedTile kind="home" place={home} onChoose={choose} meta={home ? meta(home) : undefined} />
        <SavedTile kind="office" place={office} onChoose={choose} meta={office ? meta(office) : undefined} />
      </Row>

      {!online && !showRecent ? <Banner tone="warning" body={t('plan.offlineSearch')} /> : null}

      <Card padded={false} style={styles.results}>
        <Text variant="caption" color="textMuted" weight="700" style={styles.sectionLabel}>
          {showRecent ? t('plan.recent') : t('plan.results')}
        </Text>
        {searching && rows.length === 0 ? (
          <View style={styles.loading}>
            <Skeleton height={44} />
            <Skeleton height={44} />
          </View>
        ) : rows.length === 0 ? (
          <Text color="textMuted" style={styles.empty}>
            {showRecent ? t('plan.noRecent') : t('plan.noResults')}
          </Text>
        ) : (
          rows.map((row, index) => {
            const [before, match, after] = highlight(row.title, query);
            return (
              <Pressable
                key={`${row.lat},${row.lng},${index}`}
                testID={`result-${index}`}
                onPress={() => choose(row)}
                scaleOnPress={false}
                accessibilityRole="button"
                accessibilityLabel={[row.title, row.subtitle, meta(row)].filter(Boolean).join(', ')}
                style={[styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
                <Icon name={row.source === 'recent' ? 'clock' : row.source === 'saved' ? 'star' : 'map-pin'} size={18} color="textMuted" />
                <View style={styles.flex}>
                  <Text numberOfLines={1}>
                    <Text weight="400">{before}</Text>
                    <Text weight="800">{match}</Text>
                    <Text weight="400">{after}</Text>
                  </Text>
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {[row.subtitle, meta(row)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
        {searching && rows.length > 0 ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
      </Card>

      <Button
        label={t('plan.pickOnMap')}
        variant="secondary"
        leftIcon="crosshair"
        onPress={() => router.push({ pathname: '/pin', params: { mode: editing === 'pickup' ? 'pickup' : 'destination' } })}
      />
    </Screen>
  );
}

function SavedTile({
  kind,
  place,
  onChoose,
  meta,
}: {
  kind: 'home' | 'office';
  place?: SavedPlace;
  onChoose: (p: Place) => void;
  meta?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const title = t(`places.${kind}`);
  return (
    <Pressable
      onPress={() => (place ? onChoose(place) : router.push({ pathname: '/pin', params: { mode: 'save', kind } }))}
      accessibilityRole="button"
      accessibilityLabel={place ? `${title}, ${place.label ?? ''}` : t('plan.setAddress', { place: title })}
      style={[
        styles.tile,
        place
          ? { backgroundColor: colors.surface }
          : { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: 'transparent' },
      ]}>
      <View style={[styles.tileIcon, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name={place ? (kind === 'home' ? 'home' : 'briefcase') : 'plus'} size={18} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {place ? (meta ?? place.label) : t('plan.setAddressShort')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fields: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rail: { alignItems: 'center', width: 16 },
  from: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  dash: { height: 36, borderLeftWidth: 2, borderStyle: 'dashed', marginVertical: 4 },
  to: { width: 12, height: 12, borderRadius: 2 },
  inputs: { flex: 1, gap: space[2] },
  fromBox: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: space[4], flexDirection: 'row', alignItems: 'center', gap: space[3], borderWidth: 2 },
  swap: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.lg, minHeight: 64 },
  tileIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  results: { paddingVertical: space[2] },
  sectionLabel: { paddingHorizontal: space[4], paddingVertical: space[2], letterSpacing: 0.6 },
  loading: { padding: space[4], gap: space[3] },
  empty: { paddingHorizontal: space[4], paddingBottom: space[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 60 },
  spinner: { paddingVertical: space[2] },
});
