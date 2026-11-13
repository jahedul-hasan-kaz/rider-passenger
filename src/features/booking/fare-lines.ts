import i18n from '@/i18n';
import type { FareLine } from '@/ui';

import type { Breakdown, Receipt } from '@/api/endpoints/rides';

const nonZero = (amount?: string | null) => amount !== undefined && amount !== null && Number(amount) !== 0;

/** Quote breakdown → display lines. Only shows components that apply; the total comes from the server. */
export function quoteLines(b: Breakdown): FareLine[] {
  const lines: FareLine[] = [
    { label: i18n.t('fare.base'), amount: b.base_amount },
    { label: i18n.t('fare.distance'), amount: b.distance_amount },
    { label: i18n.t('fare.time'), amount: b.time_amount },
  ];
  if (nonZero(b.surge_amount)) lines.push({ label: i18n.t('fare.surge', { x: b.surge_multiplier ?? '' }), amount: b.surge_amount });
  if (nonZero(b.minimum_adjustment)) lines.push({ label: i18n.t('fare.minimum'), amount: b.minimum_adjustment! });
  if (nonZero(b.booking_fee)) lines.push({ label: i18n.t('fare.bookingFee'), amount: b.booking_fee });
  if (nonZero(b.rounding_amount)) lines.push({ label: i18n.t('fare.rounding'), amount: b.rounding_amount!, kind: 'note' });
  if (nonZero(b.discount_amount)) lines.push({ label: i18n.t('fare.discount'), amount: b.discount_amount!, kind: 'discount' });
  lines.push({ label: i18n.t('fare.estimatedTotal'), amount: b.total_amount, kind: 'total' });
  return lines;
}

/** Receipt breakdown → display lines. */
export function receiptLines(r: Receipt): FareLine[] {
  const b = r.breakdown ?? {};
  const lines: FareLine[] = [];
  const add = (label: string, amount: string | undefined, kind?: FareLine['kind']) => {
    if (nonZero(amount)) lines.push({ label, amount: amount!, kind });
  };
  add(i18n.t('fare.base'), b.base);
  add(i18n.t('fare.distance'), b.distance);
  add(i18n.t('fare.time'), b.time);
  add(i18n.t('fare.waiting'), b.waiting);
  add(i18n.t('fare.surgeShort'), b.surge);
  add(i18n.t('fare.minimum'), b.minimum_adjustment);
  add(i18n.t('fare.bookingFee'), b.booking_fee);
  add(i18n.t('fare.rounding'), b.rounding, 'note');
  add(i18n.t('fare.discount'), b.discount, 'discount');
  lines.push({ label: i18n.t('fare.total'), amount: r.final_fare ?? b.total ?? r.estimated_fare, kind: 'total' });
  return lines;
}
