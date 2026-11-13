import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api, intents } from '@/api';
import { isApiErrorCode } from '@/api/errors';
import { addContact, listContacts, removeContact } from '@/api/endpoints/me';
import { useActiveRide } from '@/features/account/queries';
import { errorMessage } from '@/i18n';
import { isValidNational, toE164, toNationalDigits } from '@/lib/phone';
import { space } from '@/theme/tokens';
import { Banner, Button, Card, HeroHeader, ListRow, NumberedRow, Screen, Skeleton, Text, TextField, useToast } from '@/ui';

const MAX_CONTACTS = 3;
const CONTACTS_KEY = ['trusted-contacts'] as const;

// Safety centre (docs/spec/03-screens.md §7.14). SOS itself lives on the ride screen, where there is a trip to
// attach it to; this screen explains it and keeps up to three trusted contacts on the account (rider-admin
// /me/contacts).
export default function Safety() {
  const { t } = useTranslation();
  const activeRide = useActiveRide();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: CONTACTS_KEY, queryFn: () => listContacts(api()) });
  const contacts = query.data ?? [];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const national = toNationalDigits(phone);
  const canAdd = name.trim().length > 0 && isValidNational(national) && contacts.length < MAX_CONTACTS;

  const add = async () => {
    const e164 = toE164(national);
    if (!e164) return;
    setBusy(true);
    try {
      await intents().run(`contact.add:${e164}`, (key) => addContact(api(), name, e164, key));
      setName('');
      setPhone('');
      await queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    } catch (error) {
      toast({ message: isApiErrorCode(error, 'ALREADY_EXISTS') ? t('safety.contactExists') : errorMessage(error), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await removeContact(api(), id);
      await queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    } catch (error) {
      toast({ message: errorMessage(error), tone: 'danger' });
    }
  };

  return (
    <Screen hero={<HeroHeader title={t('safety.title')} subtitle={t('safety.subtitle')} onBack={() => router.back()} overlap={space[6]} />}>
      {activeRide.data ? (
        <Banner
          tone="danger"
          icon="alert-triangle"
          title={t('safety.onRide')}
          body={t('safety.onRideBody')}
          action={{ label: t('safety.openRide'), onPress: () => router.push({ pathname: '/ride/[id]', params: { id: activeRide.data!.id } }) }}
        />
      ) : null}
      <Button label={t('sos.call999')} variant="danger" leftIcon="phone" onPress={() => void Linking.openURL('tel:999')} />

      <Card>
        <Text variant="heading">{t('safety.howTitle')}</Text>
        <NumberedRow n={1} text={t('safety.how1')} />
        <NumberedRow n={2} text={t('safety.how2')} />
        <NumberedRow n={3} text={t('safety.how3')} />
      </Card>

      <Card>
        <Text variant="heading">{t('safety.contactsTitle')}</Text>
        <Text variant="caption" color="textMuted">
          {t('safety.contactsBody')}
        </Text>
        {query.isPending ? <Skeleton height={48} /> : null}
        {query.error ? <Banner tone="danger" body={errorMessage(query.error)} action={{ label: t('common.retry'), onPress: () => void query.refetch() }} /> : null}
        {contacts.map((c) => (
          <ListRow key={c.id} icon="user" title={c.name} subtitle={c.phone} value={t('places.remove')} onPress={() => void remove(c.id)} />
        ))}
        {contacts.length < MAX_CONTACTS ? (
          <View style={{ gap: space[3] }}>
            <TextField label={t('safety.contactName')} value={name} onChangeText={setName} maxLength={60} autoComplete="name" />
            <TextField label={t('safety.contactPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01712 345678" />
            <Button
              label={t('safety.addContact')}
              variant="secondary"
              disabled={!canAdd}
              loading={busy}
              onPress={() => void add()}
            />
          </View>
        ) : null}
      </Card>

      <Card>
        <Text variant="heading">{t('safety.tipsTitle')}</Text>
        <ListRow icon="hash" title={t('safety.tipPin')} subtitle={t('safety.tipPinBody')} />
        <ListRow icon="eye-off" title={t('safety.tipMask')} subtitle={t('safety.tipMaskBody')} />
        <ListRow icon="flag" title={t('safety.tipReport')} subtitle={t('safety.tipReportBody')} onPress={() => router.push({ pathname: '/support/new', params: { category: 'safety' } })} />
      </Card>
    </Screen>
  );
}
