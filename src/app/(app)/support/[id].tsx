import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, intents } from '@/api';
import { getTicket, replyTicket } from '@/api/endpoints/care';
import { keys } from '@/features/account/queries';
import { currentLanguage, errorMessage } from '@/i18n';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';
import { Banner, Button, HeroHeader, Screen, Skeleton, Text, TextField } from '@/ui';

// Ticket thread (docs/spec/03-screens.md §7.15). Internal staff notes never reach the app.
export default function TicketThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = currentLanguage();
  const queryClient = useQueryClient();
  const ticket = useQuery({ queryKey: keys.ticket(id), queryFn: () => getTicket(api(), id), refetchInterval: 30_000 });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = ticket.data?.status === 'closed';
  const time = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' });

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await intents().run(`ticket.reply:${id}:${reply.trim()}`, (key) => replyTicket(api(), id, reply, key));
      queryClient.setQueryData(keys.ticket(id), next);
      void queryClient.invalidateQueries({ queryKey: keys.tickets });
      setReply('');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const tk = ticket.data;
  return (
    <Screen
      hero={
        <HeroHeader
          title={tk ? `#${tk.ticket_no}` : t('support.title')}
          subtitle={tk ? `${tk.subject} · ${t(`support.status.${tk.status}`, { defaultValue: tk.status })}` : undefined}
          onBack={() => router.back()}
          overlap={space[6]}
        />
      }
      footer={
        closed ? undefined : (
          <View style={{ gap: space[2] }}>
            {error ? <Banner tone="danger" body={error} /> : null}
            <TextField placeholder={t('support.replyPlaceholder')} value={reply} onChangeText={setReply} maxLength={4000} multiline accessibilityLabel={t('support.reply')} />
            <Button label={t('support.reply')} onPress={() => void send()} loading={busy} disabled={!reply.trim()} />
          </View>
        )
      }>
      {ticket.isPending ? (
        <Skeleton height={80} rounded={radius.lg} />
      ) : ticket.error ? (
        <Banner tone="danger" body={errorMessage(ticket.error)} action={{ label: t('common.retry'), onPress: () => void ticket.refetch() }} />
      ) : (
        tk?.messages.map((m) => {
          const mine = m.author_type === 'user';
          return (
            <View
              key={m.id}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: mine ? colors.primary : colors.surface,
                borderRadius: radius.lg,
                padding: space[3],
                gap: space[1],
              }}>
              <Text color={mine ? 'onPrimary' : 'text'}>{m.body}</Text>
              <Text variant="caption" color={mine ? 'onPrimary' : 'textMuted'}>
                {mine ? t('support.you') : t('support.team')} · {time.format(new Date(m.created_at))}
              </Text>
            </View>
          );
        })
      )}
      {closed ? <Banner tone="neutral" body={t('support.closed')} /> : null}
    </Screen>
  );
}
