// Semantic tones (blueprint §7): colour carries meaning, never decoration, and is never the only signal -
// every toned element also has an icon and text. Adapted from finapp-admin-panel (ADR-F08).

export type Tone = 'positive' | 'caution' | 'critical' | 'info' | 'neutral';

/** The Mantine palette behind each tone. */
export const TONE_COLOR: Readonly<Record<Tone, string>> = {
  positive: 'teal',
  caution: 'orange',
  critical: 'red',
  info: 'navy',
  neutral: 'gray',
};
