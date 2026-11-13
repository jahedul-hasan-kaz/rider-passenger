import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, intents } from '@/api';
import { triggerSos, type SosResult } from '@/api/endpoints/care';
import { createTripShare } from '@/api/endpoints/me';
import { addEvidencePhoto, type EvidenceOutcome } from '@/features/ride/evidence';
import { cancelRide, getCancelPreview, getRidePin, renewRidePin, type Ride, type Trip } from '@/api/endpoints/rides';
import { keys, refreshAfterRideChange, setting, useClientConfig } from '@/features/account/queries';
import i18n, { errorMessage } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { usePreventScreenCapture } from 'expo-screen-capture';

import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { useNow } from '@/lib/use-now';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Banner, Button, Chip, CountdownRing, Icon, Row, Sheet, Skeleton, SosButton, Text, TextField, type SheetHandle } from '@/ui';

// Pieces of the ride screen (docs/spec/03-screens.md §7.10, §7.14).

export function DriverCard({ trip, etaText }: { trip: Trip; etaText?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const v = trip.driver.vehicle;
  const vehicle = [v.color, v.make, v.model].filter(Boolean).join(' ');
  const rating = trip.driver.rating_avg ? trip.driver.rating_avg.toFixed(1) : null;
  return (
    <View
      style={[styles.driver, { backgroundColor: colors.surface }]}
      accessible
      accessibilityLabel={t('ride.driverA11y', { name: trip.driver.name ?? '', plate: v.registration_number, vehicle, rating: rating ?? '—' })}>
      <View style={[styles.photo, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name="user" size={26} color="textMuted" />
      </View>
      <View style={styles.flex}>
        <Text variant="title" tabular style={styles.plate} numberOfLines={1}>
          {v.registration_number}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {vehicle}
        </Text>
        <Row gap={2}>
          <Text variant="bodyStrong">{trip.driver.name}</Text>
          {rating ? (
            <Row gap={1}>
              <Icon name="star" size={14} color="warning" />
              <Text variant="caption" tabular>
                {rating}
              </Text>
            </Row>
          ) : null}
        </Row>
      </View>
      {etaText ? (
        <View style={[styles.eta, { backgroundColor: colors.accent }]}>
          <Text variant="heading" color="onAccent" tabular>
            {etaText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Pickup PIN (flag `pickup_pin`): shown large; renewable once locked after wrong attempts. */
export function PinBlock({ rideId }: { rideId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const pin = useQuery({ queryKey: ['ride-pin', rideId], queryFn: () => getRidePin(api(), rideId), refetchInterval: 20_000 });
  const [renewing, setRenewing] = useState(false);
  if (!pin.data?.required) return null;

  const renew = async () => {
    setRenewing(true);
    try {
      const next = await intents().run(`pin.renew:${rideId}:${Date.now()}`, (key) => renewRidePin(api(), rideId, key));
      queryClient.setQueryData(['ride-pin', rideId], next);
    } finally {
      setRenewing(false);
    }
  };

  return (
    <View style={[styles.pin, { backgroundColor: colors.surfaceMuted }]}>
      <View style={styles.flex}>
        <Text variant="label">{t('ride.pinTitle')}</Text>
        <Text variant="caption" color="textMuted">
          {pin.data.locked ? t('ride.pinLocked') : t('ride.pinHelp')}
        </Text>
      </View>
      {!pin.data.locked && pin.data.pin ? <PinGuard /> : null}
      {pin.data.locked ? (
        <Button label={t('ride.pinRenew')} size="md" fullWidth={false} loading={renewing} onPress={() => void renew()} />
      ) : (
        <Text variant="display" tabular accessibilityLabel={pin.data.pin?.split('').join(' ') ?? ''} style={styles.pinDigits}>
          {pin.data.pin}
        </Text>
      )}
    </View>
  );
}

/** While the PIN is on screen it must not end up in screenshots or the app switcher (spec 05 §12.2). */
function PinGuard() {
  usePreventScreenCapture('pickup-pin');
  return null;
}

const CANCEL_REASONS = ['changedPlans', 'driverFar', 'wrongPickup', 'other'] as const;

/** Cancel with the real fee shown first (§7.10 cancel flow). */
export const CancelSheet = forwardRef<SheetHandle, { ride: Ride }>(function CancelSheet({ ride }, ref) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const config = useClientConfig();
  const sheet = useRef<SheetHandle>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof CANCEL_REASONS)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    present: () => {
      setOpen(true);
      setError(null);
      sheet.current?.present();
    },
    dismiss: () => sheet.current?.dismiss(),
  }));

  const preview = useQuery({ queryKey: ['cancel-preview', ride.id], queryFn: () => getCancelPreview(api(), ride.id), enabled: open, staleTime: 0 });
  const fee = preview.data ? Number(preview.data.fee) : 0;
  const freeWindow = setting(config.data, 'cancellation_free_window_s', 120);
  const acceptedAt = ride.trip?.accepted_at ? new Date(ride.trip.accepted_at).getTime() : null;
  const freeUntil = acceptedAt ? acceptedAt + freeWindow * 1000 : null;
  const now = useNow(1000);
  const inFreeWindow = freeUntil !== null && freeUntil > now;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await intents().run(`ride.cancel:${ride.id}`, (key) => cancelRide(api(), ride.id, reason ? t(`ride.reasons.${reason}`) : undefined, key));
      haptic('cancelled');
      track('ride_cancelled', { stage: ride.trip?.status ?? ride.status, fee, reason: reason ?? 'none' });
      queryClient.setQueryData(keys.ride(ride.id), updated);
      refreshAfterRideChange(queryClient, ride.id);
      sheet.current?.dismiss();
    } catch (failure) {
      setError(errorMessage(failure));
      void preview.refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet ref={sheet} title={t('ride.cancelTitle')} onDismiss={() => setOpen(false)}>
      {preview.isPending ? (
        <Skeleton height={48} />
      ) : preview.data && !preview.data.can_cancel ? (
        <Banner tone="warning" body={t('ride.cannotCancel')} action={{ label: t('ride.getHelp'), onPress: () => router.push('/support') }} />
      ) : (
        <Row style={styles.between}>
          <View style={styles.flex}>
            <Text variant="heading">{fee > 0 ? t('ride.cancelFee', { amount: formatMoney(preview.data!.fee) }) : t('ride.cancelFree')}</Text>
            <Text variant="caption" color="textMuted">
              {fee > 0 ? t('ride.cancelFeeWhy') : inFreeWindow ? t('ride.cancelFreeWindow') : t('ride.cancelFreeNow')}
            </Text>
          </View>
          {fee === 0 && freeUntil && inFreeWindow ? (
            <CountdownRing endsAt={freeUntil} totalSeconds={freeWindow} color="warning" onExpire={() => void preview.refetch()} />
          ) : null}
        </Row>
      )}
      {preview.data?.can_cancel !== false ? (
        <>
          <Text variant="label" color="textMuted">
            {t('ride.whyCancel')}
          </Text>
          <Row gap={2} style={styles.wrap}>
            {CANCEL_REASONS.map((r) => (
              <Chip key={r} label={t(`ride.reasons.${r}`)} selected={reason === r} onPress={() => setReason(reason === r ? null : r)} />
            ))}
          </Row>
          {error ? <Banner tone="danger" body={error} /> : null}
          <Button testID="confirm-cancel" label={t('ride.confirmCancel')} variant="danger" loading={busy} disabled={preview.isPending} onPress={() => void confirm()} />
        </>
      ) : null}
      <Button label={t('ride.keepRide')} variant="secondary" onPress={() => sheet.current?.dismiss()} />
    </Sheet>
  );
});

/** Hold-to-send SOS and its confirmation (§7.14). The request is retried hard by the API client. */
export function SosControl({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const sheet = useRef<SheetHandle>(null);
  const [state, setState] = useState<{ phase: 'idle' | 'sending' | 'sent' | 'failed'; result?: SosResult; error?: string }>({ phase: 'idle' });
  const [note, setNote] = useState('');
  const [noteSent, setNoteSent] = useState(false);
  const [photo, setPhoto] = useState<{ busy: boolean; outcome?: EvidenceOutcome; count: number }>({ busy: false, count: 0 });

  const addPhoto = async (incidentId: string, source: 'camera' | 'library') => {
    setPhoto((p) => ({ ...p, busy: true, outcome: undefined }));
    const outcome = await addEvidencePhoto(incidentId, source);
    setPhoto((p) => ({ busy: false, outcome, count: p.count + (outcome === 'added' ? 1 : 0) }));
  };

  const send = async (withNote?: string) => {
    setState({ phase: 'sending' });
    sheet.current?.present();
    try {
      const result = await triggerSos(api(), tripId, withNote);
      if (!withNote) track('sos_triggered', { repeat: result.repeat });
      setState({ phase: 'sent', result });
      if (withNote) setNoteSent(true);
    } catch (failure) {
      setState({ phase: 'failed', error: errorMessage(failure) });
    }
  };

  return (
    <>
      <SosButton testID="sos" size={56} onTrigger={() => void send()} />
      <Sheet ref={sheet} title={state.phase === 'sent' ? t('sos.sentTitle') : t('sos.sendingTitle')} dismissible={state.phase !== 'sending'}>
        {state.phase === 'sending' ? <Skeleton height={20} /> : null}
        {state.phase === 'sent' ? (
          <Banner tone="success" body={t('sos.sentBody', { no: state.result?.incident_no ?? '' })} />
        ) : null}
        {state.phase === 'failed' ? (
          <Banner tone="danger" body={state.error ?? ''} action={{ label: t('common.retry'), onPress: () => void send() }} />
        ) : null}
        <Button label={t('sos.call999')} variant="danger" leftIcon="phone" onPress={() => void Linking.openURL('tel:999')} />
        {state.phase === 'sent' && state.result ? (
          <>
            <Text variant="label">{t('sos.photoTitle')}</Text>
            <Row gap={3}>
              <View style={styles.flex}>
                <Button label={t('sos.takePhoto')} variant="secondary" size="md" leftIcon="camera" loading={photo.busy} onPress={() => void addPhoto(state.result!.id, 'camera')} />
              </View>
              <View style={styles.flex}>
                <Button label={t('sos.choosePhoto')} variant="secondary" size="md" leftIcon="image" disabled={photo.busy} onPress={() => void addPhoto(state.result!.id, 'library')} />
              </View>
            </Row>
            {photo.outcome && photo.outcome !== 'cancelled' ? (
              <Banner tone={photo.outcome === 'added' ? 'success' : 'warning'} body={t(`sos.photo.${photo.outcome}`, { count: photo.count })} />
            ) : null}
          </>
        ) : null}
        {state.phase === 'sent' && !noteSent ? (
          <>
            <TextField label={t('sos.noteLabel')} value={note} onChangeText={setNote} maxLength={2000} multiline placeholder={t('sos.notePlaceholder')} />
            <Button label={t('sos.sendNote')} variant="secondary" disabled={!note.trim()} onPress={() => void send(note)} />
          </>
        ) : null}
        <Button label={t('common.close')} variant="ghost" onPress={() => sheet.current?.dismiss()} />
      </Sheet>
    </>
  );
}

/**
 * Share the trip through the OS share sheet (§7.14) with a live tracking link from rider-admin (`/trips/{id}/share`,
 * valid until an hour after the trip). If the link can't be made (offline), the message still names the driver,
 * plate and route.
 */
export async function shareTrip(ride: Ride): Promise<void> {
  const trip = ride.trip;
  let link = '';
  if (trip) {
    link = await intents()
      .run(`trip.share:${trip.id}`, (key) => createTripShare(api(), trip.id, key))
      .catch(() => '');
  }
  const message = i18n.t(link ? 'ride.shareMessageLink' : 'ride.shareMessage', {
    driver: trip?.driver.name ?? '',
    plate: trip?.driver.vehicle.registration_number ?? '',
    from: ride.pickup.label ?? '',
    to: ride.destination.label ?? '',
    link,
  });
  await Share.share({ message }).catch(() => undefined);
}

/** Seconds since an ISO time, re-rendered every second. */
export function useSecondsSince(iso: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [iso]);
  return iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000)) : 0;
}

export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  wrap: { flexWrap: 'wrap' },
  driver: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.lg },
  photo: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  plate: { letterSpacing: 1 },
  eta: { borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2] },
  pin: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.lg },
  pinDigits: { letterSpacing: 6 },
});
