import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * Six boxes backed by one hidden input (§7.3), so SMS autofill (iOS one-time-code, Android autofill) and pasting a
 * whole code both work. Calls `onComplete` once all digits are in.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  error = false,
  autoFocus = true,
  testID,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(autoFocus);

  const handle = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      scaleOnPress={false}
      accessible={false}
      style={styles.row}>
      {Array.from({ length }, (_, index) => {
        const digit = value[index];
        const active = focused && index === Math.min(value.length, length - 1);
        return (
          <View
            key={index}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              styles.box,
              {
                backgroundColor: digit ? colors.surfaceMuted : colors.surface,
                borderColor: error ? colors.dangerText : active ? colors.primary : colors.border,
                borderWidth: active || error ? 2 : 1,
              },
            ]}>
            <Text variant="title" tabular>
              {digit ?? ''}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={input}
        testID={testID}
        value={value}
        onChangeText={handle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        accessibilityLabel={t('ui.otpLabel', { digits: length })}
        accessibilityValue={{ text: t('ui.otpEntered', { entered: value.length, digits: length }) }}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  box: { flex: 1, aspectRatio: 0.85, maxWidth: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  hidden: { position: 'absolute', width: '100%', height: '100%', opacity: 0.011, color: 'transparent' },
});
