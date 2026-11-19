import { expect, test, type Page } from '@playwright/test';
import { APP } from './checks.ts';
import { signIn, useFakeFinapp } from './fake-finapp.ts';

// P18-TSK-039 (blueprint §16 budgets): LCP <= 2.5 s, CLS <= 0.1 and interactions <= 200 ms on a mid-range phone,
// measured in the browser on the production build. "Mid-range phone" is Lighthouse's mobile profile: the CPU slowed
// four times, 150 ms latency, 1.6 Mbit/s down, 750 kbit/s up. Chromium-only (the throttling is DevTools protocol).
//
// The preview server compresses what it sends, as production does (config/nginx.conf, gzip since Stage 7 - without
// it the first load is about 620 KiB, some 3 s of transfer alone on this network). The transfer size is reported with the result.

const LCP_BUDGET_MS = 2_500;
const CLS_BUDGET = 0.1;
const INTERACTION_BUDGET_MS = 200;

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

async function observe(page: Page) {
  await page.addInitScript(() => {
    const store = { lcp: 0, cls: 0, interactions: [] as number[] };
    (window as unknown as { __vitals: typeof store }).__vitals = store;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput: boolean; value: number }>) {
        if (!entry.hadRecentInput) store.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { interactionId?: number }>) {
        if ((entry.interactionId ?? 0) > 0) store.interactions.push(entry.duration);
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });
}

const vitals = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __vitals: { lcp: number; cls: number; interactions: number[] } }).__vitals,
  );

test.describe('performance budgets on a mid-range phone', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'DevTools throttling is Chromium-only');

  test('the start page paints its largest content within 2.5 s and does not shift', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'measured once, on the phone profile');
    await observe(page);
    await throttle(page);
    await page.goto(APP);
    await expect(page.getByRole('heading', { name: 'Welcome to FinApp' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const result = await vitals(page);
    const bytes = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).transferSize, 0),
    );
    testInfo.annotations.push({
      type: 'measured',
      description: `LCP ${Math.round(result.lcp)} ms, CLS ${Math.round(result.cls * 1000) / 1000}, ${Math.round(bytes / 1024)} KiB transferred`,
    });
    expect(result.lcp).toBeGreaterThan(0);
    expect(result.lcp).toBeLessThanOrEqual(LCP_BUDGET_MS);
    expect(result.cls).toBeLessThanOrEqual(CLS_BUDGET);
  });

  test('signing in and moving between pages respond within 200 ms', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'measured once, on the phone profile');
    test.setTimeout(120_000);
    await observe(page);
    await useFakeFinapp(page);
    await throttle(page);
    await signIn(page, APP);
    for (const name of ['Accounts', 'Move money', 'Credit', 'Security', 'Home']) {
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click();
      await expect(page.locator('main h1').first()).toBeVisible();
    }
    const result = await vitals(page);
    const worst = Math.max(0, ...result.interactions);
    testInfo.annotations.push({
      type: 'measured',
      description: `${result.interactions.length} interactions, slowest ${Math.round(worst)} ms`,
    });
    expect(result.interactions.length).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(INTERACTION_BUDGET_MS);
  });
});
