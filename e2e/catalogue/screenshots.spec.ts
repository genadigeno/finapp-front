import { test } from '@playwright/test';
import { APP } from './checks.ts';
import { goWithin, IDS, signIn, useFakeFinapp } from './fake-finapp.ts';

// Screenshots of every page, for a person to look at (visual review). Not a check: runs only when SHOTS_DIR names
// a folder, e.g. `SHOTS_DIR=../shots npx playwright test -c playwright.catalogue.config.ts screenshots`.
const dir = process.env['SHOTS_DIR'];

// Headless Edge on this machine hangs in page.screenshot ("waiting for fonts") with GPU compositing on (Stage 8).
test.use({ launchOptions: { args: ['--disable-gpu'] } });

const SIGNED_OUT = ['/', '/sign-in', '/register'];
const SIGNED_IN = [
  '/home',
  '/accounts',
  '/accounts/open',
  `/accounts/${IDS.account}`,
  `/accounts/${IDS.account}/statement`,
  '/activity',
  `/activity/transfers/${IDS.transfer}`,
  '/move',
  '/move/send',
  '/move/recipients',
  '/move/top-up',
  `/move/top-ups/${IDS.payment}`,
  '/move/withdraw',
  `/move/withdrawals/${IDS.withdrawal}`,
  '/move/payment-methods',
  '/exchange',
  `/exchange/conversions/${IDS.trade}`,
  '/send-abroad',
  '/send-abroad/send',
  `/send-abroad/payments/${IDS.xbPayment}`,
  '/credit',
  '/credit/check',
  `/credit/checks/${IDS.request}`,
  '/credit/apply',
  `/credit/applications/${IDS.application}`,
  `/credit/offers/${IDS.offer}`,
  `/credit/loans/${IDS.loan}`,
  `/credit/loans/${IDS.line}`,
  `/credit/loans/${IDS.loan}/repay`,
  `/credit/loans/${IDS.loan}/payoff`,
  `/credit/loans/${IDS.line}/draw`,
  `/credit/pay-later/${IDS.agreement}`,
  `/credit/pay-later/${IDS.agreement}/dispute`,
  `/credit/pay-later/offers/${IDS.bnplOffer}`,
  '/checkout',
  '/onboarding/consents',
  '/onboarding/identity',
  '/business',
  '/security',
  '/security/two-step',
  '/security/devices',
  '/security/password',
  '/profile',
];

const name = (path: string) => (path === '/' ? 'start' : path.slice(1).replaceAll('/', '_'));

for (const scheme of ['light', 'dark'] as const) {
  test(`every page, ${scheme}`, async ({ page }, testInfo) => {
    test.skip(dir === undefined, 'screenshots only on request (SHOTS_DIR)');
    test.setTimeout(300_000);
    const prefix = `${dir}/${testInfo.project.name}-${scheme}`;
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await useFakeFinapp(page);
    for (const path of SIGNED_OUT) {
      await page.goto(`${APP}${path.slice(1)}`);
      await page.locator('main h1').first().waitFor();
      await page.screenshot({ path: `${prefix}-${name(path)}.png`, fullPage: true });
    }
    await signIn(page, APP);
    for (const path of SIGNED_IN) {
      await goWithin(page, path);
      await page.locator('main h1').first().waitFor();
      await page
        .locator('main [aria-busy="true"]')
        .first()
        .waitFor({ state: 'detached' })
        .catch(() => undefined);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${prefix}-${name(path)}.png`, fullPage: true });
    }
  });
}
