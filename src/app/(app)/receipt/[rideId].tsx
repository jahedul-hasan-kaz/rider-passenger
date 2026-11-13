import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Receipt } from '@/api/endpoints/rides';
import { receiptLines } from '@/features/booking/fare-lines';
import { useBooking } from '@/features/booking/store';
import { RateTrip, wasRated } from '@/features/ride/RateTrip';
import { useRideReceipt } from '@/features/ride/use-receipt';
import { currentLanguage, errorMessage } from '@/i18n';
import { formatDistance, formatDuration, formatMoney } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { space } from '@/theme/tokens';
import { Banner, Button, Card, FareBreakdown, HeroHeader, ListRow, Screen, Skeleton, Text, useToast } from '@/ui';

const RATING_WINDOW_MS = 7 * 24 * 3600 * 1000;

// Receipt (docs/spec/03-screens.md §7.12).
export default function ReceiptScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { t } = useTranslation();
  const toast = useToast();
  const lang = currentLanguage();
  const booking = useBooking();
  const { ride, receipt, tripId } = useRideReceipt(rideId);
  const [sharing, setSharing] = useState(false);
  const now = useNow(60_000);
  const r = receipt.data;

  const when = r?.completed_at
    ? new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(r.completed_at))
    : '';
  const canRate = !!tripId && !!r?.completed_at && now - new Date(r.completed_at).getTime() < RATING_WINDOW_MS && !wasRated(tripId);

  const share = async (receiptData: Receipt) => {
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: receiptHtml(receiptData, when, t) });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('receipt.title') });
    } catch (error) {
      toast({ message: errorMessage(error), tone: 'danger' });
    } finally {
      setSharing(false);
    }
  };

  const bookAgain = () => {
    if (!ride.data) return;
    booking.setPickup({ ...ride.data.pickup, label: ride.data.pickup.label ?? undefined });
    booking.setDestination({ ...ride.data.destination, label: ride.data.destination.label ?? undefined });
    booking.setCategory(ride.data.category_id);
    router.push('/confirm');
  };

  return (
    <Screen hero={<HeroHeader title={t('receipt.title')} subtitle={when} onBack={() => router.back()} overlap={space[6]} />}>
      <Card elevated>
        {r ? (
          <>
            <Text variant="display" tabular>
              {formatMoney(r.final_fare ?? r.estimated_fare)}
            </Text>
            <Text variant="caption" color="textMuted">
              {[t(`confirm.methods.${r.payment_method}`, { defaultValue: r.payment_method }), r.distance_m != null ? formatDistance(r.distance_m, lang) : null, r.duration_s != null ? formatDuration(r.duration_s, lang) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </>
        ) : receipt.error || ride.error ? (
          <Banner tone="danger" body={errorMessage(receipt.error ?? ride.error)} />
        ) : (
          <Skeleton height={56} width="50%" />
        )}
      </Card>
      {r ? (
        <>
          <Card>
            <ListRow icon="circle" title={r.pickup_label ?? '—'} subtitle={t('receipt.pickup')} />
            <ListRow icon="square" title={r.destination_label ?? '—'} subtitle={t('receipt.dropoff')} />
          </Card>
          <Card>
            <FareBreakdown lines={receiptLines(r)} />
          </Card>
          <Card>
            <ListRow
              icon="hash"
              title={t('receipt.tripId')}
              subtitle={r.trip_id}
              value={t('receipt.copy')}
              onPress={() => {
                void Clipboard.setStringAsync(r.trip_id);
                toast({ message: t('receipt.copied') });
              }}
            />
          </Card>
          {canRate && tripId ? (
            <Card>
              <RateTrip tripId={tripId} />
            </Card>
          ) : null}
          <Button label={t('receipt.share')} variant="secondary" leftIcon="share" loading={sharing} onPress={() => void share(r)} />
          <Button label={t('receipt.bookAgain')} leftIcon="repeat" onPress={bookAgain} />
          <Button
            label={t('receipt.help')}
            variant="ghost"
            onPress={() => router.push({ pathname: '/support/new', params: { tripId: r.trip_id, category: 'trip' } })}
          />
        </>
      ) : null}
    </Screen>
  );
}

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function receiptHtml(r: Receipt, when: string, t: (key: string) => string): string {
  const rows = receiptLines(r)
    .map((l) => `<tr${l.kind === 'total' ? ' class="total"' : ''}><td>${escape(l.label)}</td><td>${escape(formatMoney(l.kind === 'discount' ? `-${l.amount}` : l.amount))}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,'Noto Sans Bengali',sans-serif;color:#0E2A22;padding:32px}
    h1{font-size:22px;margin:0 0 4px} p{color:#5B6F68;margin:0 0 20px}
    table{width:100%;border-collapse:collapse} td{padding:8px 0;border-bottom:1px solid #D5E6DD} td:last-child{text-align:right}
    .total td{font-weight:800;font-size:18px;border-bottom:none}
  </style></head><body>
    <h1>${escape(t('receipt.title'))}</h1><p>${escape(when)}</p>
    <p>${escape(r.pickup_label ?? '')} → ${escape(r.destination_label ?? '')}</p>
    <table>${rows}</table>
    <p style="margin-top:24px">${escape(t('receipt.tripId'))}: ${escape(r.trip_id)}</p>
  </body></html>`;
}
