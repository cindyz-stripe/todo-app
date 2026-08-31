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

test('one check uses the same emoji for every sparkle', async ({ page }) => {
  await page.evaluate(() => {
    let next = 0;
    Math.random = () => (next++ % 10) / 10;
  });

  const item = page.locator('[data-section="0"] .item').first();
  await item.locator('.checkbox').click();

  const emojis = await item.locator('.sparkle').allTextContents();
  expect(emojis).toHaveLength(3);
  expect(new Set(emojis).size).toBe(1);
});

test('consecutive checks choose different celebration emojis', async ({ page }) => {
  await page.evaluate(() => { Math.random = () => 0; });
  const items = page.locator('[data-section="0"] .item');

  await items.nth(0).locator('.checkbox').click();
  const firstEmoji = await items.nth(0).locator('.sparkle').first().textContent();

  await items.nth(1).locator('.checkbox').click();
  const secondEmoji = await items.nth(1).locator('.sparkle').first().textContent();

  expect(secondEmoji).not.toBe(firstEmoji);
});

test('unchecking does not create another celebration', async ({ page }) => {
  await page.evaluate(() => { Math.random = () => 0; });
  const item = page.locator('[data-section="0"] .item').first();
  const checkbox = item.locator('.checkbox');
  const sparkles = item.locator('.sparkle');

  await checkbox.click();
  expect(await sparkles.count()).toBe(3);

  await checkbox.click();
  await expect(checkbox).not.toHaveClass(/\bchecked\b/);
  expect(await sparkles.count()).toBe(3);
});
