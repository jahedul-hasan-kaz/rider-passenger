import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, intents } from '@/api';
import { isApiErrorCode } from '@/api/errors';
import { rateTrip } from '@/api/endpoints/rides';
import { errorMessage } from '@/i18n';
import { track } from '@/lib/analytics';
import { prefs } from '@/lib/storage';
import { space } from '@/theme/tokens';
import { Banner, Button, StarRating, Text, TextField } from '@/ui';

const ratedKey = (tripId: string) => `rated.${tripId}`;
export const wasRated = (tripId: string) => prefs.getString(ratedKey(tripId)) === 'yes';

/** Optional 1–5 rating with comment (§7.11). Low scores lead to a pre-filled support ticket. */
export function RateTrip({ tripId, onDone }: { tripId: string; onDone?: () => void }) {
  const { t } = useTranslation();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(() => wasRated(tripId));
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await intents().run(`rate:${tripId}`, (key) => rateTrip(api(), tripId, score, comment, key));
      prefs.set(ratedKey(tripId), 'yes');
      track('rating_submitted', { score, has_comment: comment.trim().length > 0 });
      setDone(true);
      onDone?.();
    } catch (failure) {
      // Already rated, or the 7-day window closed: nothing more to do here.
      if (isApiErrorCode(failure, 'ALREADY_EXISTS', 'INVALID_STATE_TRANSITION')) {
        prefs.set(ratedKey(tripId), 'yes');
        setDone(true);
      } else setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={{ gap: space[3] }}>
        <Banner tone="success" body={t('rate.thanks')} />
        {score > 0 && score <= 2 ? (
          <Button
            label={t('rate.whatWentWrong')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/support/new', params: { tripId, category: 'trip' } })}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ gap: space[3] }}>
      <Text variant="heading" align="center">
        {t('rate.title')}
      </Text>
      <StarRating value={score} onChange={setScore} label={t('rate.title')} />
      {score > 0 ? (
        <>
          <TextField
            label={score <= 2 ? t('rate.commentLow') : t('rate.comment')}
            value={comment}
            onChangeText={setComment}
            maxLength={1000}
            multiline
          />
          {error ? <Banner tone="danger" body={error} /> : null}
          <Button label={t('rate.submit')} variant="secondary" loading={busy} onPress={() => void submit()} />
        </>
      ) : null}
    </View>
  );
}
