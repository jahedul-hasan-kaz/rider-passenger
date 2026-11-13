import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePlaces } from '@/features/places/places-store';
import { errorMessage } from '@/i18n';
import { space } from '@/theme/tokens';
import { Button, Card, EmptyState, HeroHeader, ListRow, Screen, useToast } from '@/ui';

// Saved places, stored on the account (rider-admin /me/places) with an offline copy on the phone.
export default function Places() {
  const { t } = useTranslation();
  const { saved, remove } = usePlaces();
  const toast = useToast();

  const confirmRemove = (id: string, name: string) =>
    Alert.alert(t('places.removeTitle', { place: name }), t('places.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('places.remove'), style: 'destructive', onPress: () => void remove(id).catch((error: unknown) => toast({ message: errorMessage(error), tone: 'danger' })) },
    ]);

  return (
    <Screen
      hero={<HeroHeader title={t('places.title')} onBack={() => router.back()} overlap={space[6]} />}
      footer={<Button label={t('places.add')} leftIcon="plus" onPress={() => router.push({ pathname: '/pin', params: { mode: 'save' } })} />}>
      {saved.length === 0 ? (
        <Card elevated>
          <EmptyState icon="bookmark" title={t('places.empty')} body={t('places.emptyBody')} />
        </Card>
      ) : (
        <Card elevated padded={false} style={{ padding: space[2] }}>
          {saved.map((p) => {
            const name = p.kind === 'other' ? (p.name ?? t('places.other')) : t(`places.${p.kind}`);
            return (
              <ListRow
                key={p.id}
                icon={p.kind === 'home' ? 'home' : p.kind === 'office' ? 'briefcase' : 'star'}
                title={name}
                subtitle={p.label}
                value={t('places.remove')}
                onPress={() => confirmRemove(p.id, name)}
              />
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
