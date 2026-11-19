import { expect, test, type Page } from '@playwright/test';
import { APP, collectViolations, cspViolations, seriousViolations, sidewaysOverflow } from './checks.ts';
import { goWithin, IDS, signIn, useFakeFinapp } from './fake-finapp.ts';

// P18-TSK-038 (blueprint §17 accessibility; DOD-CUST): EVERY signed-in page of the real production build, served with
// the real headers, signed in through the real sign-in page against a scripted finapp (fake-finapp.ts). On each page:
//   - axe reports no serious or critical violation (WCAG 2.2 AA rule set) - light theme on desktop, dark on a phone;
//   - the browser reports no CSP or Trusted Types violation;
//   - on a phone, nothing scrolls sideways;
//   - the page shows its content: no route error, no "not found", nothing still loading.
// What automation cannot judge - screen-reader announcements, reading order, cognitive load - is the manual part of
// docs/ACCESSIBILITY_AUDIT.md.

const MODULES: Record<string, readonly string[]> = {
  'home, accounts and activity': [
    '/home',
    '/accounts',
    '/accounts/open',
    `/accounts/${IDS.account}`,
    `/accounts/${IDS.account}/statement`,
    '/activity',
  ],
  'move money': [
    '/move',
    '/move/send',
    '/move/recipients',
    '/move/top-up',
    `/move/top-ups/${IDS.payment}`,
    '/move/withdraw',
    `/move/withdrawals/${IDS.withdrawal}`,
    '/move/payment-methods',
    '/exchange',
    '/send-abroad',
    '/send-abroad/send',
    `/send-abroad/payments/${IDS.xbPayment}`,
  ],
  credit: [
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
    `/credit/pay-later/${IDS.agreement}/repay`,
    `/credit/pay-later/${IDS.agreement}/payoff`,
    `/credit/pay-later/${IDS.agreement}/dispute`,
    `/credit/pay-later/applications/${IDS.bnplApplication}`,
    `/credit/pay-later/offers/${IDS.bnplOffer}`,
    '/checkout',
  ],
  'onboarding, security and profile': [
    '/onboarding/consents',
    '/onboarding/identity',
    '/business',
    '/security',
    '/security/two-step',
    '/security/devices',
    '/security/password',
    '/profile',
  ],
};

const BROKEN = /This page could not be shown|We could not find that|Something went wrong on our side/;

async function settle(page: Page, path: string) {
  await goWithin(page, path);
  await expect(page).toHaveURL(`${APP.slice(0, -1)}${path}`);
  const main = page.locator('main');
  await expect(main.locator('h1').first()).toBeVisible();
  await expect(main.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
}

for (const [module, paths] of Object.entries(MODULES)) {
  test(`every ${module} page is accessible, violates no CSP and fits the screen`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const phone = testInfo.project.name === 'phone';
    await page.emulateMedia({ colorScheme: phone ? 'dark' : 'light', reducedMotion: 'reduce' });
    await collectViolations(page);
    await useFakeFinapp(page);
    await signIn(page, APP);

    const findings: string[] = [];
    for (const path of paths) {
      await settle(page, path);
      const text = (await page.locator('main').textContent()) ?? '';
      if (BROKEN.test(text)) findings.push(`${path}: shows an error - ${BROKEN.exec(text)?.[0] ?? ''}`);
      for (const violation of await seriousViolations(page)) findings.push(`${path}: ${violation}`);
      if (phone) {
        const overflow = await sidewaysOverflow(page);
        if (overflow > 0) findings.push(`${path}: scrolls sideways by ${overflow} px`);
      }
    }
    expect(findings).toEqual([]);
    expect(await cspViolations(page)).toEqual([]);
  });
}

test('the session survives moving between pages, and nothing but the preferences key is stored', async ({ page }) => {
  await useFakeFinapp(page);
  await signIn(page, APP);
  await settle(page, '/credit');
  await settle(page, '/security/devices');
  const storage = await page.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
    cookie: document.cookie,
  }));
  // The preferences key appears only once a preference is changed.
  expect(storage.local.filter((key) => key !== 'finapp.preferences')).toEqual([]);
  expect({ session: storage.session, cookie: storage.cookie }).toEqual({ session: [], cookie: '' });
});
