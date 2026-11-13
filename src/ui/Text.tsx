import type { ReactNode } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BENGALI_LINE_HEIGHT_FACTOR, fontFamily, scriptFor } from '@/theme/fonts';
import { MAX_FONT_SCALE, typeScale, type ColorRoles, type FontWeight, type TypeVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/theme';

export type TextProps = Omit<RNTextProps, 'style'> & {
  variant?: TypeVariant;
  /** A colour role from the theme. */
  color?: keyof ColorRoles;
  weight?: FontWeight;
  align?: TextStyle['textAlign'];
  /** Tabular figures for fares, ETAs and codes (§5.2). */
  tabular?: boolean;
  style?: TextStyle | TextStyle[];
  children?: ReactNode;
};

function plainText(children: ReactNode): string | undefined {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.filter((c) => typeof c === 'string' || typeof c === 'number').join('');
  return undefined;
}

/** All text in the app goes through this: it picks the right font family for the language and weight, applies the
 *  type scale, caps font scaling at 130% and keeps colours on theme roles. */
export function Text({ variant = 'body', color = 'text', weight, align, tabular, style, children, ...rest }: TextProps) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const scale = typeScale[variant];
  const script = scriptFor(i18n.language, plainText(children));
  const lineHeight = script === 'bengali' ? Math.round(scale.lineHeight * BENGALI_LINE_HEIGHT_FACTOR) : scale.lineHeight;

  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        {
          fontFamily: fontFamily(weight ?? scale.weight, script),
          fontSize: scale.fontSize,
          lineHeight,
          color: colors[color],
          textAlign: align,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}>
      {children}
    </RNText>
  );
}
