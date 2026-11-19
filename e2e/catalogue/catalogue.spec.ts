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
      store.push(
        `${event.violatedDirective} blocked ${event.blockedURI || '(inline)'} at ${event.sourceFile}:${event.lineNumber}:${event.columnNumber} ${event.sample}`,
      );
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
      // An input inside Mantine's bordered box (a password field) is tapped through that box, and a radio through its
      // row with its label: measure what the customer taps.
      .map((element) => ({
        element,
        box: (element.closest('.mantine-Input-input, .mantine-Radio-body') ?? element).getBoundingClientRect(),
      }))
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

  test('a protected page sends a signed-out visitor to sign in', async ({ page }) => {
    await page.goto(`${APP}home`);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/sign-in');
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/home');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`sign-in and registration are accessible and violate no CSP (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await collectViolations(page);
      await page.goto(`${APP}sign-in`);
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
      // An empty submit shows the field errors; the password field's visibility toggle writes styles.
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('Enter your login name.')).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      await page.getByRole('link', { name: 'Open an account' }).click();
      await expect(page.getByRole('heading', { name: 'Open an account' })).toBeVisible();
      await page.getByLabel('Login name').fill('not an email@x');
      await page.getByRole('button', { name: 'Open my account' }).click();
      await expect(page.getByText(/Use 3 to 64 letters/)).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      expect(await cspViolations(page)).toEqual([]);
    });
  }
});

test('the onboarding controls open without a CSP violation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCatalogue(page, 'light');
  const section = page.getByRole('region', { name: 'Onboarding controls' });
  // The Select's input; its listbox carries the same label.
  await section.getByLabel('Document', { exact: true }).first().click();
  await page.getByRole('option', { name: 'Passport' }).click();
  await section
    .getByRole('button', { name: /Show password|Toggle password visibility/i })
    .first()
    .click();
  expect(await seriousViolations(page)).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
});

test('the core banking controls switch tabs without a CSP violation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCatalogue(page, 'dark');
  const section = page.getByRole('region', { name: 'Core banking controls' });
  await section.getByRole('tab', { name: 'Top-ups and purchases' }).click();
  await expect(section.getByText('+€100.00')).toBeVisible();
  await section.getByLabel('From').fill('2026-10-01');
  expect(await seriousViolations(page)).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
});

test('the money movement controls open without an accessibility or CSP violation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCatalogue(page, 'light');
  const section = page.getByRole('region', { name: 'Money movement controls' });
  await section.getByLabel('Pay from', { exact: true }).first().click();
  await page.getByRole('option', { name: /JPY/ }).click();
  await section.getByRole('radio', { name: 'receive' }).check();
  expect(await seriousViolations(page)).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
});
