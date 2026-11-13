import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '@/api';
import { listTickets } from '@/api/endpoints/care';
import { keys } from '@/features/account/queries';
import { currentLanguage, errorMessage } from '@/i18n';
import { space } from '@/theme/tokens';
import { Banner, Button, Card, HeroHeader, Icon, ListRow, Pressable, Row, Screen, Skeleton, Text } from '@/ui';

const FAQ = ['fare', 'cancel', 'lost', 'cash', 'account'] as const;

// Support (docs/spec/03-screens.md §7.15): my tickets, a new ticket, and answers that work offline.
export default function Support() {
  const { t } = useTranslation();
  const lang = currentLanguage();
  const tickets = useQuery({ queryKey: keys.tickets, queryFn: () => listTickets(api()) });
  const [open, setOpen] = useState<string | null>(null);
  const date = new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' });

  return (
    <Screen
      hero={<HeroHeader title={t('support.title')} subtitle={t('support.subtitle')} onBack={() => router.back()} overlap={space[6]} />}
      footer={<Button label={t('support.new')} leftIcon="plus" onPress={() => router.push('/support/new')} />}>
      <Card elevated padded={false} style={{ padding: space[2] }}>
        <Text variant="label" color="textMuted" style={{ padding: space[2] }}>
          {t('support.myTickets')}
        </Text>
        {tickets.isPending ? (
          <View style={{ padding: space[2], gap: space[2] }}>
            <Skeleton height={48} />
            <Skeleton height={48} />
          </View>
        ) : tickets.error ? (
          <Banner tone="danger" body={errorMessage(tickets.error)} action={{ label: t('common.retry'), onPress: () => void tickets.refetch() }} />
        ) : tickets.data?.length ? (
          tickets.data.map((ticket) => (
            <ListRow
              key={ticket.id}
              icon={ticket.status === 'resolved' || ticket.status === 'closed' ? 'check-circle' : 'message-circle'}
              title={`#${ticket.ticket_no} · ${ticket.subject}`}
              subtitle={`${t(`support.status.${ticket.status}`, { defaultValue: ticket.status })} · ${date.format(new Date(ticket.updated_at))}`}
              onPress={() => router.push({ pathname: '/support/[id]', params: { id: ticket.id } })}
            />
          ))
        ) : (
          <Text color="textMuted" style={{ padding: space[2] }}>
            {t('support.none')}
          </Text>
        )}
      </Card>

      <Text variant="heading">{t('support.faqTitle')}</Text>
      <Card padded={false}>
        {FAQ.map((key) => (
          <Pressable
            key={key}
            onPress={() => setOpen(open === key ? null : key)}
            scaleOnPress={false}
            accessibilityRole="button"
            accessibilityState={{ expanded: open === key }}
            accessibilityLabel={t(`support.faq.${key}.q`)}
            style={{ padding: space[4], gap: space[2] }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {t(`support.faq.${key}.q`)}
              </Text>
              <Icon name={open === key ? 'chevron-up' : 'chevron-down'} size={18} color="textMuted" />
            </Row>
            {open === key ? <Text color="textMuted">{t(`support.faq.${key}.a`)}</Text> : null}
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
