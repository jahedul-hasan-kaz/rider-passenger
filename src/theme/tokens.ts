// Design tokens (docs/spec/02-design-system.md §5.1). Raw palette first, then semantic roles per theme.
// Components use semantic roles only, never the raw palette, so light and dark stay consistent.

export const palette = {
  brand950: '#07241C',
  brand900: '#0B3B2E',
  brand800: '#124D3C',
  brand700: '#1E5A47',
  accent400: '#6EE7B7',
  accent300: '#A7F3D0',
  white: '#FFFFFF',
  surface50: '#F1F7F4',
  surface100: '#E3F1EA',
  surface200: '#D5E6DD',
  ink: '#0E2A22',
  inkMuted: '#5B6F68',
  mintInk: '#E8F5EE',
  mintInkMuted: '#A3C2B6',
  danger500: '#E5533D',
  danger700: '#B5371F',
  danger300: '#F59B8A',
  danger50: '#FDE7E2',
  warning500: '#E0A100',
  warning800: '#7A5600',
  warning300: '#F2C14E',
  warning50: '#FFF4D6',
  info600: '#2563EB',
  info300: '#93C5FD',
  info50: '#E3EDFD',
  success700: '#11734F',
  success50: '#DDF5EA',
} as const;

export type ColorRoles = {
  /** Screen background. */
  background: string;
  /** Cards, inputs, sheets. */
  surface: string;
  /** Info rows, chips, disabled fills. */
  surfaceMuted: string;
  /** Selected card fill. */
  surfaceSelected: string;
  /** Deep-green header that curves into the screen. */
  hero: string;
  onHero: string;
  onHeroMuted: string;
  text: string;
  textMuted: string;
  /** Primary button fill on normal surfaces. */
  primary: string;
  onPrimary: string;
  /** Mint: primary action on dark, progress, selected ring, pickup dot. Never text on white. */
  accent: string;
  onAccent: string;
  border: string;
  borderStrong: string;
  /** Fill colours for markers, SOS and icons; use the *Text roles for words. */
  danger: string;
  dangerText: string;
  dangerSurface: string;
  warning: string;
  warningText: string;
  warningSurface: string;
  info: string;
  infoText: string;
  infoSurface: string;
  successText: string;
  successSurface: string;
  disabled: string;
  onDisabled: string;
  scrim: string;
  shadow: string;
};

export const lightColors: ColorRoles = {
  background: palette.surface50,
  surface: palette.white,
  surfaceMuted: palette.surface100,
  surfaceSelected: palette.brand800,
  hero: palette.brand900,
  onHero: palette.mintInk,
  onHeroMuted: palette.mintInkMuted,
  text: palette.ink,
  textMuted: palette.inkMuted,
  primary: palette.brand900,
  onPrimary: palette.white,
  accent: palette.accent400,
  onAccent: palette.brand900,
  border: palette.surface200,
  borderStrong: '#9DBDAF',
  danger: palette.danger500,
  dangerText: palette.danger700,
  dangerSurface: palette.danger50,
  warning: palette.warning500,
  warningText: palette.warning800,
  warningSurface: palette.warning50,
  info: palette.info600,
  infoText: '#1D4FBF',
  infoSurface: palette.info50,
  successText: palette.success700,
  successSurface: palette.success50,
  disabled: '#C3D6CD',
  onDisabled: '#3F5A50',
  scrim: 'rgba(7, 36, 28, 0.55)',
  shadow: '#0B3B2E',
};

export const darkColors: ColorRoles = {
  background: palette.brand950,
  surface: '#0F3328',
  surfaceMuted: palette.brand800,
  surfaceSelected: palette.brand700,
  hero: palette.brand900,
  onHero: palette.mintInk,
  onHeroMuted: palette.mintInkMuted,
  text: palette.mintInk,
  textMuted: palette.mintInkMuted,
  primary: palette.accent400,
  onPrimary: palette.brand900,
  accent: palette.accent400,
  onAccent: palette.brand900,
  border: palette.brand700,
  borderStrong: '#3F7D68',
  danger: '#F07A66',
  dangerText: palette.danger300,
  dangerSurface: '#4A1F18',
  warning: palette.warning300,
  warningText: palette.warning300,
  warningSurface: '#3D3010',
  info: palette.info300,
  infoText: palette.info300,
  infoSurface: '#14284A',
  successText: palette.accent300,
  successSurface: '#123F31',
  disabled: '#1E4A3C',
  onDisabled: '#A9C8BC',
  scrim: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
};

/** 4-pt spacing scale. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;
export type Space = keyof typeof space;

export const radius = { sm: 8, md: 12, lg: 20, xl: 28, pill: 999 } as const;

/** Minimum touch target (dp). */
export const touchTarget = 48;

export const elevation = {
  card: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  sheet: { shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 8 },
} as const;

export const duration = { fast: 150, standard: 220, slow: 320 } as const;

/** Text scale (§5.2). Bengali gets +15% line height in the Text component. */
export const typeScale = {
  display: { fontSize: 32, lineHeight: 38, weight: '800' },
  title: { fontSize: 24, lineHeight: 30, weight: '800' },
  heading: { fontSize: 18, lineHeight: 24, weight: '700' },
  bodyStrong: { fontSize: 16, lineHeight: 22, weight: '600' },
  body: { fontSize: 16, lineHeight: 22, weight: '400' },
  label: { fontSize: 14, lineHeight: 18, weight: '600' },
  caption: { fontSize: 13, lineHeight: 18, weight: '400' },
} as const;

export type TypeVariant = keyof typeof typeScale;
export type FontWeight = '400' | '500' | '600' | '700' | '800';

/** Largest system font scale layouts are designed for (§5.2). */
export const MAX_FONT_SCALE = 1.3;
