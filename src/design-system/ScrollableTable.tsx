// A table wider than a phone scrolls sideways inside a labelled region that the keyboard can reach (WCAG 2.1.1;
// axe `scrollable-region-focusable`) - found by the Stage 7 browser sweep on the credit schedules. The page itself
// never scrolls sideways. Widths come from the stylesheet: no inline style (ADR-F07).
import type { ReactNode } from 'react';

export function ScrollableTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="finapp-table-scroll" tabIndex={0} aria-label={label}>
      {children}
    </section>
  );
}
