import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { receiptLines } from '@/features/booking/fare-lines';
import { useBooking } from '@/features/booking/store';
import { RateTrip } from '@/features/ride/RateTrip';
import { useRideReceipt } from '@/features/ride/use-receipt';
import { currentLanguage, errorMessage } from '@/i18n';
import { formatDistance, formatDuration, formatMoney } from '@/lib/format';
import { space } from '@/theme/tokens';
import { Banner, Button, Card, FareBreakdown, HeroHeader, Icon, Row, Screen, Skeleton, Text } from '@/ui';

// Trip complete (docs/spec/03-screens.md §7.11): what to pay in cash, how it was calculated, and an optional rating.
export default function TripComplete() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { t } = useTranslation();
  const lang = currentLanguage();
  const resetBooking = useBooking((s) => s.reset);
  const { ride, receipt, tripId } = useRideReceipt(rideId);
  const r = receipt.data;

  const done = () => {
    resetBooking();
    router.replace('/home');
  };

  const differs = r && r.final_fare && r.final_fare !== r.estimated_fare;

  return (
    <Screen
      hero={
        <HeroHeader title={t('complete.title')} subtitle={r?.destination_label ?? ride.data?.destination.label ?? undefined} overlap={space[6]}>
          <Row gap={2}>
            <Icon name="check-circle" color="accent" size={20} />
            <Text variant="label" color="onHeroMuted">
              {t('complete.arrived')}
            </Text>
          </Row>
        </HeroHeader>
      }
      footer={<Button testID="complete-done" label={t('common.done')} onPress={done} />}>
      <Card elevated>
        {r ? (
          <>
            <Text variant="label" color="textMuted">
              {t('complete.payCash')}
            </Text>
            <Text variant="display" tabular testID="final-fare">
              {formatMoney(r.final_fare ?? r.estimated_fare)}
            </Text>
            <Text variant="caption" color="textMuted">
              {[r.distance_m != null ? formatDistance(r.distance_m, lang) : null, r.duration_s != null ? formatDuration(r.duration_s, lang) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </>
        ) : receipt.error || ride.error ? (
          <Banner tone="danger" body={errorMessage(receipt.error ?? ride.error)} action={{ label: t('common.retry'), onPress: () => void receipt.refetch() }} />
        ) : (
          <Skeleton height={56} width="60%" />
        )}
      </Card>

      {differs ? <Banner tone="info" body={t('complete.differs', { estimate: formatMoney(r.estimated_fare) })} /> : null}

      {r ? (
        <Card>
          <FareBreakdown lines={receiptLines(r)} />
        </Card>
      ) : null}

      {tripId ? (
        <Card>
          <RateTrip tripId={tripId} />
        </Card>
      ) : null}

      <Button
        label={t('complete.problem')}
        variant="ghost"
        size="md"
        onPress={() => router.push({ pathname: '/support/new', params: { tripId: tripId ?? '', category: 'trip' } })}
      />
    </Screen>
  );
}
