import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useMe, useWallet } from '@/features/account/queries';
import { formatMoney } from '@/lib/format';
import { maskE164 } from '@/lib/phone';
import { space } from '@/theme/tokens';
import { Avatar, Card, HeroHeader, ListRow, Row, Screen, Text } from '@/ui';

// Account menu (docs/spec/03-screens.md §6): everything secondary, one tap from Home. Reachable without location,
// so help is always available (§7.4 rule).
export default function Account() {
  const { t } = useTranslation();
  const me = useMe();
  const wallet = useWallet(me.data?.role === 'passenger');
  const owed = wallet.data && Number(wallet.data.outstanding_fee) > 0 ? formatMoney(wallet.data.outstanding_fee) : undefined;

  return (
    <Screen
      hero={
        <HeroHeader onBack={() => router.back()} overlap={space[6]}>
          <Row gap={4}>
            <Avatar name={me.data?.full_name} size={56} label={t('account.profile')} onPress={() => router.push('/profile')} />
            <Text variant="title" color="onHero" style={{ flex: 1 }} numberOfLines={1}>
              {me.data?.full_name ?? ''}
            </Text>
          </Row>
          <Text color="onHeroMuted">{me.data?.phone ? maskE164(me.data.phone) : (me.data?.email ?? '')}</Text>
        </HeroHeader>
      }>
      <Card elevated padded={false} style={{ padding: space[2] }}>
        <ListRow icon="clock" title={t('account.history')} onPress={() => router.push('/history')} />
        <ListRow icon="credit-card" title={t('account.wallet')} subtitle={owed ? t('account.owed', { amount: owed }) : undefined} onPress={() => router.push('/wallet')} />
        <ListRow icon="bookmark" title={t('account.places')} onPress={() => router.push('/places')} />
      </Card>
      <Card padded={false} style={{ padding: space[2] }}>
        <ListRow icon="shield" title={t('account.safety')} onPress={() => router.push('/safety')} />
        <ListRow icon="life-buoy" title={t('account.support')} onPress={() => router.push('/support')} />
      </Card>
      <Card padded={false} style={{ padding: space[2] }}>
        <ListRow icon="user" title={t('account.profile')} onPress={() => router.push('/profile')} />
        <ListRow icon="settings" title={t('account.settings')} onPress={() => router.push('/settings')} />
      </Card>
    </Screen>
  );
}
