import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, intents } from '@/api';
import { createTicket, TICKET_CATEGORIES, type TicketCategory } from '@/api/endpoints/care';
import { keys } from '@/features/account/queries';
import { errorMessage } from '@/i18n';
import { space } from '@/theme/tokens';
import { Banner, Button, Card, Chip, HeroHeader, Row, Screen, Text, TextField, useToast } from '@/ui';

// New support ticket (docs/spec/03-screens.md §7.15), optionally about a trip.
export default function NewTicket() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ tripId?: string; category?: TicketCategory }>();
  const tripId = params.tripId || undefined;
  const [category, setCategory] = useState<TicketCategory | null>(
    params.category && (TICKET_CATEGORIES as readonly string[]).includes(params.category) ? params.category : null,
  );
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = !!category && subject.trim().length >= 3 && body.trim().length >= 1;

  const submit = async () => {
    if (!valid || !category) return;
    setBusy(true);
    setError(null);
    try {
      const ticket = await intents().run(`ticket:${category}:${subject.trim()}:${body.trim().length}`, (key) =>
        createTicket(api(), { category, subject, body, tripId }, key),
      );
      void queryClient.invalidateQueries({ queryKey: keys.tickets });
      toast({ message: t('support.sent', { no: ticket.ticket_no }), tone: 'success' });
      router.replace({ pathname: '/support/[id]', params: { id: ticket.id } });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      hero={<HeroHeader title={t('support.new')} subtitle={tripId ? t('support.aboutTrip') : undefined} onBack={() => router.back()} overlap={space[6]} />}
      footer={<Button label={t('support.send')} onPress={() => void submit()} loading={busy} disabled={!valid} />}>
      <Card elevated>
        <View style={{ gap: space[2] }}>
          <Text variant="label">{t('support.category')}</Text>
          <Row gap={2} style={{ flexWrap: 'wrap' }}>
            {TICKET_CATEGORIES.map((c) => (
              <Chip key={c} label={t(`support.categories.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </Row>
        </View>
        <TextField label={t('support.subject')} value={subject} onChangeText={setSubject} maxLength={200} helper={t('support.subjectHelp')} />
        <TextField
          label={t('support.message')}
          value={body}
          onChangeText={setBody}
          maxLength={4000}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          helper={`${body.length}/4000`}
        />
      </Card>
      {error ? <Banner tone="danger" body={error} /> : null}
    </Screen>
  );
}
