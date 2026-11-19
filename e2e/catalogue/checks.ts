import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

// The browser checks every run shares (ADR-F07; DOD-CUST): CSP and Trusted Types violations as the browser reports
// them, and axe's serious and critical findings against WCAG 2.2 AA.

export const CATALOGUE = 'http://localhost:4181/catalogue/index.html';
export const APP = 'http://localhost:4180/';

export async function collectViolations(page: Page) {
  // Installed before any script of ours runs, so no violation can be missed.
  await page.addInitScript(() => {
    const store: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = store;
    document.addEventListener('securitypolicyviolation', (event) => {
      store.push(
        `${event.violatedDirective} blocked ${event.blockedURI || '(inline)'} at ${event.sourceFile}:${event.lineNumber}:${event.columnNumber} ${event.sample}`,
      );
    });
  });
}

export const cspViolations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);

export async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

/** Pixels the page is wider than its viewport (a phone must never scroll sideways). */
export const sidewaysOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
