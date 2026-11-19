import { Anchor, createTheme, DEFAULT_THEME, mergeMantineTheme, type MantineTheme } from '@mantine/core';

// The customer theme (blueprint §7): calm, plain, roomy - not the console's dense operator style. Same
// Mantine engine, its own tokens: a larger type scale, generous spacing, 44 px touch targets
// (design-system.css), system fonts only (the CSP allows fonts from 'self'; nothing is fetched).
export const themeOverride = createTheme({
  primaryColor: 'blue',
  // Filled colours carry white text. Mantine's default shade (6) is ~3.4:1, under WCAG AA's 4.5:1; shade 9
  // passes for blue (5.9), red (5.3) and teal (4.9) - measured by the console's catalogue. Orange cannot
  // reach 4.5:1 at any shade, so caution actions never use a filled orange button.
  primaryShade: { light: 9, dark: 9 },
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: 'ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace',
  defaultRadius: 'md',
  fontSizes: { xs: '0.875rem', sm: '0.9375rem', md: '1rem', lg: '1.125rem', xl: '1.375rem' },
  lineHeights: { xs: '1.45', sm: '1.5', md: '1.55', lg: '1.55', xl: '1.5' },
  headings: {
    fontWeight: '650',
    sizes: {
      h1: { fontSize: '1.75rem', lineHeight: '1.25' },
      h2: { fontSize: '1.375rem', lineHeight: '1.3' },
      h3: { fontSize: '1.125rem', lineHeight: '1.4' },
    },
  },
  autoContrast: true,
  respectReducedMotion: true,
  cursorType: 'pointer',
  components: {
    // A link is told apart by more than its colour (WCAG 1.4.1): always underlined.
    Anchor: Anchor.extend({ defaultProps: { underline: 'always' } }),
  },
});

/** The complete theme the static stylesheet is generated from. */
export const theme: MantineTheme = mergeMantineTheme(DEFAULT_THEME, themeOverride);
