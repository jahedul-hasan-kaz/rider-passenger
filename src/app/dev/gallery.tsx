import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { currentLanguage, setLanguage } from '@/i18n';
import { formatDistance, formatDuration, formatMoney } from '@/lib/format';
import { useTheme, type ThemeMode } from '@/theme/theme';
import { space } from '@/theme/tokens';
import {
  Banner,
  Button,
  Card,
  Chip,
  CountdownRing,
  Divider,
  EmptyState,
  FareBreakdown,
  HeroHeader,
  Icon,
  MapPin,
  OtpInput,
  PhoneField,
  Row,
  Screen,
  SegmentedControl,
  SelectableCard,
  Sheet,
  Skeleton,
  SosButton,
  StepIndicator,
  Text,
  TextField,
  useToast,
  type SheetHandle,
} from '@/ui';

// Development-only catalogue of every design-system primitive (spec 02), for checking light/dark, English/Bengali
// and large font sizes on a real device. Not reachable in staging or production builds.
export default function Gallery() {
  if (!__DEV__) return <Redirect href="/" />;
  return <GalleryContent />;
}

function GalleryContent() {
  const { t } = useTranslation();
  const theme = useTheme();
  const toast = useToast();
  const sheet = useRef<SheetHandle>(null);
  const [phone, setPhone] = useState('17123');
  const [code, setCode] = useState('482');
  const [vehicle, setVehicle] = useState<'bike' | 'cng' | 'car'>('bike');
  const [place, setPlace] = useState<'home' | 'office' | 'other'>('office');
  const [loading, setLoading] = useState(false);
  const [endsAt] = useState(() => Date.now() + 90_000);
  const lang = currentLanguage();

  return (
    <Screen
      hero={
        <HeroHeader title="Design system" subtitle="Every primitive, live" onBack={() => router.back()} overlap={space[4]}>
          <StepIndicator step={1} total={3} />
        </HeroHeader>
      }
      footer={<Button label={t('common.continue')} rightIcon="arrow-right" onPress={() => toast({ message: 'Primary action', tone: 'success' })} />}>
      <Card elevated>
        <View style={styles.stack}>
          <Text variant="heading">Settings</Text>
          <SegmentedControl<ThemeMode>
            accessibilityLabel="Theme"
            segments={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={theme.mode}
            onChange={theme.setMode}
          />
          <Button
            variant="secondary"
            size="md"
            label={t('language.switchTo')}
            onPress={() => void setLanguage(lang === 'en' ? 'bn' : 'en')}
          />
        </View>
      </Card>

      <Section title="Type">
        <Text variant="display">Dhaka, on your schedule.</Text>
        <Text variant="title">ঢাকা, আপনার সময়ে।</Text>
        <Text variant="heading">Heading 18</Text>
        <Text>Body 16 — verified drivers, upfront fares and SOS on every trip.</Text>
        <Text variant="caption" color="textMuted">
          Caption 13 · {formatMoney('125000.00')} · {formatDistance(6200, lang)} · {formatDuration(1320, lang)}
        </Text>
      </Section>

      <Section title="Buttons">
        <Button label="Send code" onPress={() => undefined} />
        <Button label="Get started" variant="accent" onPress={() => undefined} />
        <Button label="Continue with Google" variant="secondary" onPress={() => undefined} />
        <Button
          label="Request Bike"
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1500);
          }}
        />
        <Button label="Select a destination" disabled onPress={() => undefined} />
        <Row>
          <Button label="Cancel ride" variant="danger" size="md" fullWidth={false} onPress={() => undefined} />
          <Button label="Not now" variant="ghost" size="md" fullWidth={false} onPress={() => undefined} />
        </Row>
      </Section>

      <Section title="Inputs">
        <PhoneField value={phone} onChangeDigits={setPhone} helper="We'll text a 6-digit code." />
        <OtpInput value={code} onChange={setCode} autoFocus={false} onComplete={(c) => toast({ message: `Code ${c}` })} />
        <TextField label="Your name (shown to driver)" placeholder="e.g. Rahim" />
        <TextField label="Note for driver" placeholder="e.g. Gate 2" error="Keep it under 300 characters." />
        <Divider label={t('ui.or')} />
      </Section>

      <Section title="Selection">
        <Row gap={3} style={styles.wrap}>
          {(['bike', 'cng', 'car'] as const).map((v) => (
            <SelectableCard key={v} selected={vehicle === v} onPress={() => setVehicle(v)} accessibilityLabel={v} style={styles.vehicle}>
              <Icon name={v === 'bike' ? 'navigation' : 'truck'} color={vehicle === v ? 'onHero' : 'text'} size={28} />
              <Text variant="heading" color={vehicle === v ? 'onHero' : 'text'}>
                {v.toUpperCase()}
              </Text>
              <Text variant="caption" color={vehicle === v ? 'onHeroMuted' : 'textMuted'}>
                2 min · 1 seat
              </Text>
            </SelectableCard>
          ))}
        </Row>
        <SegmentedControl
          accessibilityLabel="Save place as"
          segments={[
            { value: 'home', label: 'Home' },
            { value: 'office', label: 'Office' },
            { value: 'other', label: 'Other' },
          ]}
          value={place}
          onChange={setPlace}
        />
        <Row gap={2} style={styles.wrap}>
          <Chip label="Number masking" icon="shield" />
          <Chip label="No password" icon="lock" />
          <Chip label="Too far" selected onPress={() => undefined} />
          <Chip label="Changed plans" onPress={() => undefined} />
        </Row>
      </Section>

      <Section title="Status">
        <Banner tone="info" body="Bike carries 1 passenger. Helmet provided by driver." />
        <Banner tone="warning" title="Fares are higher right now ×1.3" body="Demand is high near you." />
        <Banner tone="danger" body="৳30 from a cancelled ride will be added to your next fare." action={{ label: 'Details', onPress: () => undefined }} />
        <Banner tone="success" body="Code detected from SMS" />
        <Skeleton height={20} width="60%" />
        <Skeleton height={64} rounded={20} />
        <EmptyState icon="clock" title="No rides yet" body="Your rides will appear here." action={{ label: 'Book a ride', onPress: () => undefined }} />
      </Section>

      <Section title="Ride">
        <FareBreakdown
          lines={[
            { label: 'Base fare', amount: '40.00' },
            { label: 'Distance · 6.2 km', amount: '124.00' },
            { label: 'Time · 22 min', amount: '22.00' },
            { label: 'Booking fee', amount: '14.00' },
            { label: 'Promo WELCOME', amount: '10.00', kind: 'discount' },
            { label: 'Total', amount: '190.00', kind: 'total' },
          ]}
        />
        <Row gap={6} style={styles.center}>
          <CountdownRing endsAt={endsAt} totalSeconds={90} />
          <MapPin label="Office" />
          <SosButton onTrigger={() => toast({ message: 'SOS triggered', tone: 'danger' })} />
        </Row>
        <Button label="Open a sheet" variant="secondary" onPress={() => sheet.current?.present()} />
        <Button label="Show a toast" variant="secondary" onPress={() => toast({ message: 'This ride was taken by another driver.' })} />
      </Section>

      <Sheet ref={sheet} title="Location is off">
        <Text color="textMuted">We can&apos;t show drivers or fares without it. Turn it on in 3 taps:</Text>
        <Button label="Open settings" onPress={() => sheet.current?.dismiss()} />
        <Button label="Try again" variant="secondary" onPress={() => sheet.current?.dismiss()} />
      </Sheet>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.stack}>
      <Text variant="label" color="textMuted" accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[3] },
  wrap: { flexWrap: 'wrap' },
  vehicle: { flexGrow: 1, flexBasis: 100, gap: space[2], minHeight: 140 },
  center: { justifyContent: 'center' },
});
