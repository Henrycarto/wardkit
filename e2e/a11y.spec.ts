// axe in a real browser against the built docs site: every page, with every <details> open,
// in light and dark colour schemes. This is where colour contrast is checked.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = ['/', '/components/lab-result', '/components/vitals-trend', '/components/news2-panel', '/components/allergy-banner', '/components/patient-banner'];

for (const path of PAGES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${path} has no axe violations (${scheme})`, async ({ page }) => {
      await page.goto(path);
      if (scheme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const found = result.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join('\n  ')}`);
      expect(found).toEqual([]);
    });
  }
}

test('no horizontal scroll at phone width', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone');
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
