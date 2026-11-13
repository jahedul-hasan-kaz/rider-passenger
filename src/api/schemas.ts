import { z } from 'zod';

// Shared response building blocks. Response objects are deliberately *not* strict: the server may add fields at any
// time, and an older app must keep working. Requests, by contrast, are strict on the server (unknown keys rejected).

/**
 * Money is display-only in the app (docs/spec/04-integration.md §8.1). The API spec promises decimal strings but the
 * as-built backend returns JSON numbers (gap B15), so both are accepted and normalised to a 2-dp string.
 * The app never adds, subtracts or rounds fares itself.
 */
export const money = z.union([z.string().regex(/^-?\d+(\.\d+)?$/), z.number().finite()]).transform((value) => {
  const text = typeof value === 'number' ? value.toFixed(2) : value;
  const [whole, fraction = ''] = text.split('.');
  return `${whole}.${(fraction + '00').slice(0, 2)}`;
});
export type Money = z.output<typeof money>;

export const currency = z.literal('BDT');
export const isoDateTime = z.iso.datetime({ offset: true });
export const uuid = z.uuid();

export const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const metaSchema = z.object({
  request_id: z.string().optional(),
  next_cursor: z.string().nullable().optional(),
});
export type ResponseMeta = z.infer<typeof metaSchema>;

export const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  meta: metaSchema.optional(),
});

export function successEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data, meta: metaSchema.optional() });
}
