const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.section')).toHaveCount(2);
});

test('toggle checkbox, sparkle animation, state persists', async ({ page }) => {
  const cb = page.locator('[data-section="0"] .item').first().locator('.checkbox');
  // Check
  await cb.click();
  await expect(cb).toHaveClass(/checked/);
  // Sparkles appear
  await expect(page.locator('[data-section="0"] .item').first().locator('.sparkle').first()).toBeVisible();
  // Uncheck
  await cb.click();
  await expect(cb).not.toHaveClass(/\bchecked\b/);
  // Check state persists in data
  await cb.click();
  const md = await page.evaluate(() => window._todoSerialize(window._todoState.data));
  expect(md).toContain('- [x] first item');
});
