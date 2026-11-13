import { forwardRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { fontFamily, scriptFor } from '@/theme/fonts';
import { MAX_FONT_SCALE, radius, space, typeScale } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  helper?: string;
  /** Replaces the helper and turns the border red; announced to screen readers. */
  error?: string;
  left?: ReactNode;
  right?: ReactNode;
  /** Larger text for the one field a screen is about (phone number, destination). */
  size?: 'md' | 'lg';
};

/** Label above, helper or error below, ≥ 48 dp tall, focus ring in mint, error in red text (§5.3). */
export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { label, helper, error, left, right, size = 'md', onFocus, onBlur, editable = true, accessibilityLabel, ...input },
  ref,
) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const [focused, setFocused] = useState(false);
  const script = scriptFor(i18n.language);
  const borderColor = error ? colors.dangerText : focused ? colors.primary : colors.border;
  const scale = size === 'lg' ? typeScale.heading : typeScale.body;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" nativeID={input.nativeID ? `${input.nativeID}-label` : undefined}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.box,
          size === 'lg' && styles.boxLg,
          { borderColor, backgroundColor: editable ? colors.surface : colors.surfaceMuted, borderWidth: focused || error ? 2 : 1 },
        ]}>
        {left}
        <TextInput
          ref={ref}
          {...input}
          editable={editable}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={error ?? helper}
          aria-invalid={error ? true : undefined}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            { color: colors.text, fontFamily: fontFamily(size === 'lg' ? '600' : '400', script), fontSize: scale.fontSize },
          ]}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" color="dangerText" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" color="textMuted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  box: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  boxLg: { minHeight: 64, borderRadius: radius.lg },
  // Browsers draw their own focus ring; the field already shows focus with its border.
  input: { flex: 1, paddingVertical: space[3], ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null) },
});
