import { forwardRef } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatNational, toNationalDigits } from '@/lib/phone';
import { useTheme } from '@/theme/theme';

import { Text } from './Text';
import { TextField } from './TextField';

/**
 * Fixed `+880` prefix and the 10 national digits, shown grouped as `17 1234 5678` (§7.2). Pasting any common form
 * (`01712…`, `+8801712…`) is normalised. `value` and `onChangeDigits` deal in raw digits only.
 */
export const PhoneField = forwardRef<
  TextInputInstance,
  { value: string; onChangeDigits: (digits: string) => void; error?: string; helper?: string; autoFocus?: boolean; testID?: string }
>(function PhoneField({ value, onChangeDigits, error, helper, autoFocus, testID }, ref) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <TextField
      ref={ref}
      testID={testID}
      size="lg"
      value={formatNational(value)}
      onChangeText={(text) => onChangeDigits(toNationalDigits(text))}
      keyboardType="phone-pad"
      inputMode="tel"
      autoComplete="tel"
      textContentType="telephoneNumber"
      autoFocus={autoFocus}
      maxLength={12 + 5}
      placeholder="17 1234 5678"
      accessibilityLabel={t('ui.phoneNumber')}
      error={error}
      helper={helper}
      left={
        <View style={[styles.prefix, { borderRightColor: colors.border }]}>
          <Text variant="bodyStrong" weight="700" tabular>
            +880
          </Text>
        </View>
      }
    />
  );
});

const styles = StyleSheet.create({
  prefix: { paddingRight: 12, borderRightWidth: 1, alignSelf: 'stretch', justifyContent: 'center' },
});
