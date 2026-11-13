import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { isApiErrorCode } from '@/api/errors';
import { isRideActive, type Ride } from '@/api/endpoints/rides';
import { useBooking } from '@/features/booking/store';
import { RideMap } from '@/features/map/RideMap';
import { CancelSheet, clock, DriverCard, PinBlock, shareTrip, SosControl, useSecondsSince } from '@/features/ride/parts';
import { STALE_AFTER_MS, useLiveRide } from '@/features/ride/use-live-ride';
import { currentLanguage, errorMessage } from '@/i18n';
import { formatDuration, formatMoney } from '@/lib/format';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { useNow } from '@/lib/use-now';
import { elevation, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Banner, Button, Icon, MapPin, Pressable, Row, Skeleton, Text, type SheetHandle } from '@/ui';

// Ride screen (docs/spec/03-screens.md §7.10): one map, one panel whose content follows the server state.
// The passenger can leave at any point and come back to exactly the same place.
export default function RideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const live = useLiveRide(id);
  const ride = live.data;
  const stage = live.stage;
  const now = useNow(1000);
  const cancelSheet = useRef<SheetHandle>(null);
  const announced = useRef<string | null>(null);

  // Haptic + screen-reader cue on each new stage.
  useEffect(() => {
    if (!stage || announced.current === stage) return;
    if (announced.current && ride) {
      if (stage === 'driver_assigned' && ride.trip?.accepted_at) {
        track('match_time', { seconds: (Date.parse(ride.trip.accepted_at) - Date.parse(ride.requested_at)) / 1000 });
      }
      if (stage === 'no_driver_found') track('no_driver_found', {});
      if (stage === 'completed' && ride.trip?.final_fare) {
        const est = Number(ride.estimated_fare);
        track('trip_completed', { variance_pct: est > 0 ? ((Number(ride.trip.final_fare) - est) / est) * 100 : 0 });
      }
      if (stage === 'driver_assigned') haptic('driverFound');
      else if (stage.startsWith('cancelled') || stage === 'no_driver_found' || stage === 'failed') haptic('cancelled');
      else haptic('tap');
    }
    announced.current = stage;
  }, [stage, ride]);

  // Completed: straight to the trip summary.
  useEffect(() => {
    if (ride && stage === 'completed' && ride.trip) router.replace({ pathname: '/complete/[rideId]', params: { rideId: ride.id } });
  }, [ride, stage]);

  if (!ride) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {live.error ? (
          <>
            <Banner tone="danger" body={isApiErrorCode(live.error, 'NOT_FOUND') ? t('ride.notFound') : errorMessage(live.error)} />
            <Button label={t('ride.home')} onPress={() => router.replace('/home')} />
          </>
        ) : (
          <MapPin pulsing />
        )}
      </View>
    );
  }

  const stale = live.driver ? now - live.driver.at > STALE_AFTER_MS : false;
  const showDriver = !!ride.trip && ['driver_assigned', 'driver_arriving', 'arrived', 'in_progress'].includes(ride.trip.status);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {isRideActive(ride) ? <KeepAwake /> : null}
      <View style={styles.map}>
        <RideMap
          pickup={ride.pickup}
          destination={ride.destination}
          driver={showDriver && live.driver ? { ...live.driver, stale } : null}
          route
          fitPadding={{ top: insets.top + 60, bottom: 60, left: 48, right: 48 }}
          style={StyleSheet.absoluteFill}
        />
        {stage === 'searching' || stage === 'requested' ? (
          <View style={styles.searching} pointerEvents="none">
            <MapPin pulsing />
          </View>
        ) : null}
        <Pressable
          onPress={() => router.navigate('/home')}
          accessibilityRole="button"
          accessibilityLabel={t('ride.minimise')}
          style={[styles.mini, elevation.card, { top: insets.top + space[3], backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
          <Icon name="chevron-down" size={22} />
        </Pressable>
        {live.isRefetchError ? (
          <View style={[styles.syncing, { top: insets.top + space[3], backgroundColor: colors.warningSurface }]}>
            <Text variant="caption" color="warningText" weight="600">
              {t('ride.updating')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.panel, elevation.sheet, { backgroundColor: colors.background, shadowColor: colors.shadow, paddingBottom: insets.bottom + space[3] }]}>
        <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
        <ScrollView contentContainerStyle={styles.panelContent} accessibilityLiveRegion="polite">
          <StagePanel ride={ride} stage={stage ?? ride.status} onCancel={() => cancelSheet.current?.present()} driverAt={live.driver?.at} stale={stale} now={now} />
        </ScrollView>
      </View>
      <CancelSheet ref={cancelSheet} ride={ride} />
    </View>
  );
}

function KeepAwake() {
  useKeepAwake();
  return null;
}

function StagePanel({
  ride,
  stage,
  onCancel,
  driverAt,
  stale,
  now,
}: {
  ride: Ride;
  stage: string;
  onCancel: () => void;
  driverAt?: number;
  stale: boolean;
  now: number;
}) {
  const { t } = useTranslation();
  const lang = currentLanguage();
  const booking = useBooking();
  const trip = ride.trip;
  const searchingFor = useSecondsSince(stage === 'searching' || stage === 'requested' ? ride.requested_at : null);
  const waitingFor = useSecondsSince(stage === 'arrived' ? trip?.arrived_at : null);
  const sinceAccepted = useSecondsSince(trip?.accepted_at ?? null);
  const sinceDriverFix = driverAt ? Math.round((now - driverAt) / 1000) : 0;

  const rebook = () => {
    booking.setPickup({ ...ride.pickup, label: ride.pickup.label ?? undefined });
    booking.setDestination({ ...ride.destination, label: ride.destination.label ?? undefined });
    booking.setCategory(ride.category_id);
    router.replace('/confirm');
  };

  const fare = (
    <Row style={styles.between}>
      <Text variant="caption" color="textMuted">
        {t('ride.fare')}
      </Text>
      <Text variant="bodyStrong" tabular>
        {formatMoney(trip?.final_fare ?? ride.estimated_fare)} · {t(`confirm.methods.${ride.payment_method}`, { defaultValue: ride.payment_method })}
      </Text>
    </Row>
  );
  const route = (
    <View style={styles.route}>
      <Row gap={2}>
        <Icon name="circle" size={12} color="accent" />
        <Text variant="caption" numberOfLines={1} style={styles.flex}>
          {ride.pickup.label}
        </Text>
      </Row>
      <Row gap={2}>
        <Icon name="square" size={12} color="danger" />
        <Text variant="caption" numberOfLines={1} style={styles.flex}>
          {ride.destination.label}
        </Text>
      </Row>
    </View>
  );

  switch (stage) {
    case 'requested':
    case 'searching':
      return (
        <>
          <Text variant="title" accessibilityRole="header">
            {t('ride.searching')}
          </Text>
          <Text color="textMuted" tabular>
            {t('ride.searchingFor', { time: clock(searchingFor) })}
          </Text>
          {route}
          {fare}
          <Button testID="cancel-ride" label={t('ride.cancelFreeButton')} variant="secondary" onPress={onCancel} />
        </>
      );

    case 'no_driver_found':
      return (
        <>
          <Text variant="title" accessibilityRole="header">
            {t('ride.noDriver')}
          </Text>
          <Text color="textMuted">{t('ride.noDriverBody')}</Text>
          <Button label={t('common.retry')} onPress={rebook} />
          <Button label={t('ride.changeVehicle')} variant="secondary" onPress={() => router.replace('/home')} />
          <Button label={t('common.close')} variant="ghost" onPress={() => router.replace('/home')} />
        </>
      );

    case 'driver_assigned':
    case 'driver_arriving':
    case 'arrived': {
      const etaLeft = trip?.pickup_eta_s != null ? Math.max(60, trip.pickup_eta_s - sinceAccepted) : null;
      const arrived = stage === 'arrived';
      return (
        <>
          {arrived ? (
            <Banner tone="success" icon="map-pin" title={t('ride.arrivedTitle')} body={t('ride.waiting', { time: clock(waitingFor) })} />
          ) : (
            <Text variant="title" accessibilityRole="header">
              {t('ride.onTheWay')}
            </Text>
          )}
          {trip ? <DriverCard trip={trip} etaText={!arrived && etaLeft ? formatDuration(etaLeft, lang) : undefined} /> : null}
          {stale && driverAt ? (
            <Text variant="caption" color="textMuted">
              {t('ride.updatedAgo', { seconds: sinceDriverFix })}
            </Text>
          ) : null}
          <PinBlock rideId={ride.id} />
          <Row gap={3}>
            {trip ? <SosControl tripId={trip.id} /> : null}
            <View style={styles.flex}>
              <Button label={t('ride.share')} variant="secondary" size="md" leftIcon="share-2" onPress={() => void shareTrip(ride)} />
            </View>
            <View style={styles.flex}>
              <Button testID="cancel-ride" label={t('ride.cancel')} variant="ghost" size="md" onPress={onCancel} />
            </View>
          </Row>
          {fare}
        </>
      );
    }

    case 'in_progress':
      return (
        <>
          <Text variant="title" accessibilityRole="header">
            {t('ride.inProgress')}
          </Text>
          <Text color="textMuted" numberOfLines={2}>
            {t('ride.heading', { place: ride.destination.label ?? '' })}
          </Text>
          {trip ? <DriverCard trip={trip} /> : null}
          <Row gap={3}>
            {trip ? <SosControl tripId={trip.id} /> : null}
            <View style={styles.flex}>
              <Button label={t('ride.shareLive')} variant="secondary" size="md" leftIcon="share-2" onPress={() => void shareTrip(ride)} />
            </View>
            <View style={styles.flex}>
              <Button
                label={t('ride.help')}
                variant="ghost"
                size="md"
                onPress={() => router.push({ pathname: '/support/new', params: { tripId: trip?.id ?? '', category: 'trip' } })}
              />
            </View>
          </Row>
          {fare}
        </>
      );

    case 'cancelled_by_driver':
      return (
        <>
          <Text variant="title" accessibilityRole="header">
            {t('ride.driverCancelled')}
          </Text>
          <Text color="textMuted">{t('ride.notCharged')}</Text>
          <Button label={t('ride.findAnother')} onPress={rebook} />
          <Button label={t('ride.home')} variant="ghost" onPress={() => router.replace('/home')} />
        </>
      );

    case 'cancelled_by_passenger': {
      const fee = trip?.cancellation_fee && Number(trip.cancellation_fee) > 0 ? trip.cancellation_fee : null;
      return (
        <>
          <Text variant="title" accessibilityRole="header">
            {t('ride.youCancelled')}
          </Text>
          <Text color="textMuted">{fee ? t('ride.feeCharged', { amount: formatMoney(fee) }) : t('ride.notCharged')}</Text>
          <Button label={t('common.done')} onPress={() => router.replace('/home')} />
        </>
      );
    }

    case 'cancelled_by_admin':
    case 'failed':
      return (
        <>
          <Text variant="title" accessibilityRole="header">
            {t('ride.ended')}
          </Text>
          <Text color="textMuted">{trip?.cancellation_reason ?? ride.cancel_reason ?? t('ride.endedBody')}</Text>
          <Button label={t('ride.bookAgain')} onPress={rebook} />
          <Button
            label={t('ride.contactSupport')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/support/new', params: { tripId: trip?.id ?? '', category: 'trip' } })}
          />
        </>
      );

    case 'completed':
      return <Skeleton height={60} />;

    default:
      return (
        <>
          <Text variant="heading">{t('ride.updating')}</Text>
          {route}
        </>
      );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[4] },
  flex: { flex: 1 },
  map: { flex: 1 },
  searching: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  mini: { position: 'absolute', left: space[4], width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  syncing: { position: 'absolute', alignSelf: 'center', borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: space[1] },
  panel: { marginTop: -space[6], borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '62%' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: space[2] },
  panelContent: { padding: space[5], gap: space[4] },
  between: { justifyContent: 'space-between' },
  route: { gap: space[2] },
});
