// The theme as a STATIC stylesheet (ADR-F07 decision 1). Adapted from
// finapp-admin-panel/src/design-system/theme-stylesheet.ts (ADR-F08).
//
// MantineProvider normally injects its CSS variables and its breakpoint classes as inline <style>
// elements, which the CSP (`style-src 'self'`) refuses. The provider runs with both
// injections off, and this module produces the same CSS - with Mantine's own resolver and
// converter - into src/design-system/theme.generated.css, a file the bundle serves from 'self'.
// tests/theme-stylesheet.test.ts fails when the committed file and the theme disagree;
// `npm run theme:generate` rewrites it.
import {
  convertCssVariables,
  defaultCssVariablesResolver,
  em,
  keys,
  px,
  type CSSVariablesResolver,
  type MantineTheme,
} from '@mantine/core';

/**
 * Text colours for the tone palettes, tuned to WCAG 2.2 AA (4.5:1) on both white and the palette's
 * own `light` background - the console's catalogue axe run measured Mantine's defaults (teal-9 on its light background 4.32,
 * orange-9 3.61). Mantine's orange cannot reach 4.5:1 at any shade, so the
 * light scheme uses darker values outside the palette; the dark scheme uses the palette's light shades.
 */
const LIGHT_TEXT: Readonly<Record<string, string>> = {
  navy: 'var(--mantine-color-navy-9)',
  blue: 'var(--mantine-color-blue-9)',
  teal: '#065f46',
  orange: '#9a3412',
  red: 'var(--mantine-color-red-9)',
  gray: 'var(--mantine-color-gray-9)',
};

function contrastOverrides(scheme: 'light' | 'dark'): Record<string, string> {
  const overrides: Record<string, string> = {
    // Slate, not grey: 5.9:1 on white, 5.4:1 on the page canvas; dark-1 is 7.7:1 on a dark card.
    '--mantine-color-dimmed': scheme === 'light' ? '#5a6576' : 'var(--mantine-color-dark-1)',
    // Placeholder text: Mantine's default is under 4.5:1 (found by the Stage 2 catalogue run on a FileInput).
    '--mantine-color-placeholder': scheme === 'light' ? '#5a6576' : 'var(--mantine-color-dark-1)',
    // A field's error text: red-9 (5.3:1) on light, red-3 on dark (the console's every-route axe run).
    '--mantine-color-error': scheme === 'light' ? 'var(--mantine-color-red-9)' : 'var(--mantine-color-red-3)',
  };
  for (const [palette, light] of Object.entries(LIGHT_TEXT)) {
    const text = scheme === 'light' ? light : `var(--mantine-color-${palette}-3)`;
    overrides[`--mantine-color-${palette}-light-color`] = text;
    overrides[`--mantine-color-${palette}-text`] = text;
  }
  return overrides;
}

/** Mantine's variables plus the application's own `--finapp-*` tokens and the contrast overrides. */
export const finappCssVariablesResolver: CSSVariablesResolver = (theme) => {
  const base = defaultCssVariablesResolver(theme);
  return {
    variables: {
      ...base.variables,
      '--finapp-numeric': 'tabular-nums',
      '--finapp-touch-target': '2.75rem',
      '--finapp-content-width': '48rem',
    },
    // The page sits on a cool grey canvas; cards and the header are the surface above it (Stage 8 visual refresh).
    light: {
      ...base.light,
      ...contrastOverrides('light'),
      // Navy actions: navy-8 with white text (9.6:1), a shade darker on hover. Every other palette stays on shade 9.
      '--mantine-color-navy-filled': 'var(--mantine-color-navy-8)',
      '--mantine-color-navy-filled-hover': 'var(--mantine-color-navy-9)',
      '--mantine-color-text': '#1b2533',
      '--mantine-color-default-border': '#e2e7ee',
      '--finapp-canvas': '#f4f6f9',
      '--finapp-surface': 'var(--mantine-color-white)',
      '--finapp-surface-subtle': '#f7f9fc',
      '--finapp-hairline': '#edf0f5',
      '--finapp-heading': '#121a26',
      '--finapp-accent-surface': 'var(--mantine-color-navy-8)',
      '--finapp-card-shadow': 'var(--mantine-shadow-xs)',
    },
    dark: {
      ...base.dark,
      ...contrastOverrides('dark'),
      '--mantine-color-anchor': 'var(--mantine-color-navy-3)',
      // Navy actions in the dark: navy-6 with white text (5.7:1) stands out from the slate cards; navy-9 would not.
      '--mantine-color-navy-filled': 'var(--mantine-color-navy-6)',
      '--mantine-color-navy-filled-hover': 'var(--mantine-color-navy-7)',
      // The navy tint (icon tiles, the selected navigation entry, info chips): a translucent lift, not a darker hole.
      '--mantine-color-navy-light': 'rgba(91, 125, 179, 0.18)',
      '--mantine-color-navy-light-hover': 'rgba(91, 125, 179, 0.26)',
      '--mantine-color-gray-light': 'var(--mantine-color-dark-5)',
      '--mantine-color-gray-light-hover': 'var(--mantine-color-dark-4)',
      '--finapp-canvas': 'var(--mantine-color-dark-8)',
      '--finapp-surface': 'var(--mantine-color-dark-6)',
      '--finapp-surface-subtle': 'var(--mantine-color-dark-7)',
      '--finapp-hairline': 'var(--mantine-color-dark-5)',
      '--finapp-heading': '#e8ecf2',
      '--finapp-accent-surface': 'var(--mantine-color-navy-8)',
      '--finapp-card-shadow': 'none',
    },
  };
};

/** The hiddenFrom/visibleFrom classes MantineProvider would otherwise inject (MantineClasses). */
function breakpointClasses(theme: MantineTheme): string {
  return keys(theme.breakpoints)
    .map((breakpoint) => {
      const value = theme.breakpoints[breakpoint] ?? '0em';
      const pxValue = px(value);
      const below = value.includes('px') ? `${Number(pxValue) - 0.1}px` : em(Number(pxValue) - 0.1);
      const from = value.includes('px') ? `${pxValue}px` : em(pxValue);
      return (
        `@media (max-width: ${below}) {.mantine-visible-from-${breakpoint} {display: none !important;}}\n` +
        `@media (min-width: ${from}) {.mantine-hidden-from-${breakpoint} {display: none !important;}}`
      );
    })
    .join('\n');
}

export function themeStylesheet(theme: MantineTheme): string {
  const variables = convertCssVariables(finappCssVariablesResolver(theme));
  const scheme = convertCssVariables({
    variables: {},
    dark: { '--mantine-color-scheme': 'dark' },
    light: { '--mantine-color-scheme': 'light' },
  });
  return [
    '/* GENERATED by `npm run theme:generate` from src/design-system/theme.ts - do not edit. */',
    variables,
    scheme,
    breakpointClasses(theme),
    '',
  ].join('\n');
}
