const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.section')).toHaveCount(2);
});

test('markdown round-trip preserves all formatting', async ({ page }) => {
  const md = await page.evaluate(() => window._todoSerialize(window._todoState.data));
  expect(md).toContain('## 👩🏻‍💻 Today');
  expect(md).toContain('## 📖 Read');
  expect(md).toContain('- [ ] first item');
  expect(md).toContain('- [x] already done');
  expect(md).toContain('    - [ ] child item');
  expect(md).toContain('[a link](https://example.com)');
  expect(md).toContain('[Some doc](https://docs.example.com/foo)');
});

test('edit + save preserves other items', async ({ page }) => {
  await page.locator('.item-text').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' edited');
  await page.locator('.header').click();
  await page.waitForTimeout(100);
  const md = await page.evaluate(() => window._todoSerialize(window._todoState.data));
  expect(md).toContain('- [ ] first item edited');
  expect(md).toContain('- [ ] parent item');
  expect(md).toContain('    - [ ] child item');
});
