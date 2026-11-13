import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { isFlagOn } from '@/api/endpoints/account';
import { useClientConfig, useWallet } from '@/features/account/queries';
import { errorMessage } from '@/i18n';
import { formatMoney } from '@/lib/format';
import { space } from '@/theme/tokens';
import { Banner, Card, HeroHeader, ListRow, NumberedRow, Screen, Skeleton, Text } from '@/ui';

// Wallet (docs/spec/03-screens.md §7.13): credit, any cancellation fee owed, and how paying works today.
export default function Wallet() {
  const { t } = useTranslation();
  const wallet = useWallet();
  const config = useClientConfig();
  const w = wallet.data;
  const owed = w && Number(w.outstanding_fee) > 0;
  const digital = isFlagOn(config.data, 'digital_payments');

  return (
    <Screen hero={<HeroHeader title={t('wallet.title')} onBack={() => router.back()} overlap={space[6]} />}>
      <Card elevated>
        <Text variant="label" color="textMuted">
          {t('wallet.credit')}
        </Text>
        {w ? (
          <Text variant="display" tabular>
            {formatMoney(w.credit)}
          </Text>
        ) : wallet.error ? (
          <Banner tone="danger" body={errorMessage(wallet.error)} action={{ label: t('common.retry'), onPress: () => void wallet.refetch() }} />
        ) : (
          <Skeleton height={40} width="40%" />
        )}
      </Card>
      {owed ? (
        <Banner tone="warning" title={t('wallet.owedTitle', { amount: formatMoney(w!.outstanding_fee) })} body={t('wallet.owedBody')} />
      ) : null}
      <Card>
        <Text variant="heading">{t('wallet.howTitle')}</Text>
        <NumberedRow n={1} text={t('wallet.how1')} />
        <NumberedRow n={2} text={t('wallet.how2')} />
        <NumberedRow n={3} text={t('wallet.how3')} />
      </Card>
      <Card>
        <ListRow icon="dollar-sign" title={t('confirm.methods.cash')} value={t('wallet.available')} />
        {digital ? <ListRow icon="smartphone" title={t('wallet.digital')} value={t('wallet.available')} /> : null}
        {!digital ? <ListRow icon="smartphone" title={t('wallet.digital')} subtitle={t('wallet.digitalSoon')} /> : null}
      </Card>
    </Screen>
  );
}
