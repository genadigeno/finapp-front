import {
  Anchor,
  createTheme,
  DEFAULT_THEME,
  mergeMantineTheme,
  type MantineColorsTuple,
  type MantineTheme,
} from '@mantine/core';

// The customer theme (blueprint §7): calm, plain, roomy - a finance product, not a marketing site. A deep navy "ink"
// for actions and emphasis, soft slate neutrals, white cards on a cool grey page, and a navy-slate dark scheme. Colour
// carries meaning only (tone.ts); nothing flashes, nothing is shouted in capitals. System fonts only (the CSP allows
// fonts from 'self'; nothing is fetched). 44 px touch targets (design-system.css).
//
// Contrast, measured (Stage 8 visual refresh): white on navy-8 9.6:1 (light primary), on navy-6 5.7:1 (dark primary);
// navy-8 text on white 9.6:1; navy-3 text on the dark page 8.4:1; dark-0 text on dark-6 cards 11.1:1.

const navy: MantineColorsTuple = [
  '#f0f4fa',
  '#e1e9f4',
  '#c3d2e8',
  '#9fb6d8',
  '#7b98c5',
  '#5b7db3',
  '#44679f',
  '#34558a',
  '#284574',
  '#1d355c',
];

/** Mantine's `dark` palette, tinted towards navy: the dark scheme's text (0-2), borders (4), cards (6), page (7-8). */
const dark: MantineColorsTuple = [
  '#d5dbe5',
  '#aeb8c8',
  '#8c97aa',
  '#6b778c',
  '#3b4659',
  '#2c3546',
  '#1d2533',
  '#151b26',
  '#10151e',
  '#0b0f16',
];

export const themeOverride = createTheme({
  colors: { navy, dark },
  primaryColor: 'navy',
  // Filled colours carry white text. The shade applies to every palette: Mantine's default (6) is ~3.4:1, under
  // WCAG AA's 4.5:1; shade 9 passes for red (5.3), teal (4.9) and blue (5.9) - measured by the console's catalogue.
  // Navy's own filled shades (navy-8 light, navy-6 dark) are set in theme-stylesheet.ts.
  primaryShade: { light: 9, dark: 9 },
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: 'ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace',
  defaultRadius: 'md',
  radius: { xs: '4px', sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  shadows: {
    xs: '0 1px 2px rgba(16, 24, 40, 0.05)',
    sm: '0 1px 3px rgba(16, 24, 40, 0.07), 0 1px 2px rgba(16, 24, 40, 0.04)',
    md: '0 4px 12px rgba(16, 24, 40, 0.08)',
    lg: '0 12px 24px rgba(16, 24, 40, 0.1)',
    xl: '0 20px 32px rgba(16, 24, 40, 0.12)',
  },
  fontSizes: { xs: '0.875rem', sm: '0.9375rem', md: '1rem', lg: '1.125rem', xl: '1.375rem' },
  lineHeights: { xs: '1.45', sm: '1.5', md: '1.55', lg: '1.55', xl: '1.5' },
  headings: {
    fontWeight: '650',
    sizes: {
      h1: { fontSize: '1.75rem', lineHeight: '1.25' },
      h2: { fontSize: '1.25rem', lineHeight: '1.35' },
      h3: { fontSize: '1.0625rem', lineHeight: '1.4' },
    },
  },
  autoContrast: true,
  respectReducedMotion: true,
  cursorType: 'pointer',
  components: {
    // A link is told apart by more than its colour (WCAG 1.4.1): always underlined (thin and offset, in CSS).
    Anchor: Anchor.extend({ defaultProps: { underline: 'always' } }),
  },
});

/** The complete theme the static stylesheet is generated from. */
export const theme: MantineTheme = mergeMantineTheme(DEFAULT_THEME, themeOverride);
