import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// P18-TSK-007 acceptance (blueprint §22 item 7): every design-system component, in both themes, is
//   - accessible: axe reports no serious or critical violation (WCAG 2.2 AA rule set);
//   - compatible with the production CSP and Trusted Types: the browser reports no violation.
// Adapted from finapp-admin-panel/e2e/catalogue/catalogue.spec.ts (ADR-F08).

const CATALOGUE = 'http://localhost:4181/catalogue/index.html';
const APP = 'http://localhost:4180/';

async function collectViolations(page: Page) {
  // Installed before any script of ours runs, so no violation can be missed.
  await page.addInitScript(() => {
    const store: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = store;
    document.addEventListener('securitypolicyviolation', (event) => {
      store.push(`${event.violatedDirective} blocked ${event.blockedURI || '(inline)'}`);
    });
  });
}

async function openCatalogue(page: Page, scheme: 'light' | 'dark') {
  await collectViolations(page);
  const response = await page.goto(`${CATALOGUE}?scheme=${scheme}`);
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("style-src 'self'");
  expect(csp).toContain("require-trusted-types-for 'script'");
  await expect(page.getByRole('heading', { name: 'Component catalogue' })).toBeVisible();
}

const cspViolations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} theme`, () => {
    test('has no serious or critical accessibility violation', async ({ page }) => {
      await openCatalogue(page, scheme);
      expect(await seriousViolations(page)).toEqual([]);
    });

    for (const [opener, name] of [
      ['Open step-up dialog', 'Confirm it is you'],
      ['Open close-wallet confirmation', 'Close this wallet?'],
    ] as const) {
      test(`has no serious or critical violation with "${name}" open`, async ({ page }) => {
        // Judged once the dialog has settled: mid fade-in, its text is translucent and axe would measure a
        // contrast no customer reads. With reduced motion the theme opens dialogs without a transition.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await openCatalogue(page, scheme);
        await page.getByRole('button', { name: opener }).click();
        await expect(page.getByRole('dialog', { name })).toBeVisible();
        expect(await seriousViolations(page)).toEqual([]);
      });
    }

    test('triggers no violation of the content security policy', async ({ page }) => {
      await openCatalogue(page, scheme);
      // Exercise the paths that write styles: the theme switch, a tooltip, both modals, an input's error.
      const toggle = page.getByRole('button', { name: /Switch to (light|dark) theme/ });
      await toggle.hover();
      await toggle.click();
      await page.getByRole('button', { name: 'Check amount' }).click();
      await expect(page.getByText('EUR amounts have at most 2 decimals.')).toBeVisible();
      await page.getByRole('button', { name: 'Open step-up dialog' }).click();
      const stepUp = page.getByRole('dialog', { name: 'Confirm it is you' });
      await stepUp.getByLabel('Authentication code').fill('123');
      await stepUp.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect(stepUp.getByText('Enter the 6 digits shown in your app.')).toBeVisible();
      await stepUp.getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: 'Open close-wallet confirmation' }).click();
      const closeWallet = page.getByRole('dialog', { name: 'Close this wallet?' });
      await expect(closeWallet).toBeVisible();
      await closeWallet.getByRole('button', { name: 'Cancel' }).click();
      expect(await cspViolations(page)).toEqual([]);
    });
  });
}

test('touch targets are at least 44 px', async ({ page }) => {
  await openCatalogue(page, 'light');
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main button, main input')]
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0 && box.height < 43.5)
      .map(
        ({ element, box }) => `${element.tagName} "${element.textContent?.trim() ?? ''}" ${Math.round(box.height)}px`,
      ),
  );
  expect(small).toEqual([]);
});

test.describe('the application build', () => {
  test('its start page is accessible and violates no CSP, with only the preferences key in storage', async ({
    page,
  }) => {
    await collectViolations(page);
    const response = await page.goto(APP);
    expect(response?.headers()['content-security-policy']).toContain("default-src 'none'");
    await expect(page.getByRole('heading', { name: 'Welcome to FinApp' })).toBeVisible();
    await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await cspViolations(page)).toEqual([]);
    const storage = await page.evaluate(() => ({
      local: Object.keys(window.localStorage),
      session: Object.keys(window.sessionStorage),
      cookie: document.cookie,
    }));
    expect(storage).toEqual({ local: ['finapp.preferences'], session: [], cookie: '' });
  });

  test('a protected page sends a signed-out visitor to the start page', async ({ page }) => {
    await page.goto(`${APP}home`);
    await expect(page.getByRole('heading', { name: 'Welcome to FinApp' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/home');
  });
});
