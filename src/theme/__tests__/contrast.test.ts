import { contrastRatio } from '../contrast';
import { darkColors, lightColors, type ColorRoles } from '../tokens';

// §5.1: all text ≥ 4.5:1 (WCAG AA), in both themes.
const TEXT_PAIRS: [keyof ColorRoles, keyof ColorRoles][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceMuted'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['onHero', 'hero'],
  ['onHeroMuted', 'hero'],
  ['onPrimary', 'primary'],
  ['onAccent', 'accent'],
  ['dangerText', 'surface'],
  ['dangerText', 'dangerSurface'],
  ['warningText', 'surface'],
  ['warningText', 'warningSurface'],
  ['infoText', 'surface'],
  ['infoText', 'infoSurface'],
  ['successText', 'successSurface'],
  ['onDisabled', 'disabled'],
];

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
])('%s theme', (_name, colors) => {
  it.each(TEXT_PAIRS)('%s on %s meets AA', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

it('keeps danger button labels readable', () => {
  expect(contrastRatio(lightColors.onPrimary, lightColors.dangerText)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(darkColors.onAccent, darkColors.dangerText)).toBeGreaterThanOrEqual(4.5);
});

it('never uses mint as text on white', () => {
  expect(contrastRatio(lightColors.accent, lightColors.surface)).toBeLessThan(4.5);
  expect(lightColors.text).not.toBe(lightColors.accent);
  expect(lightColors.textMuted).not.toBe(lightColors.accent);
});
