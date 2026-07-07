const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.section')).toHaveCount(2);
});

test('tab indents and shift+tab outdents', async ({ page }) => {
  await page.locator('[data-section="0"] .item-text').nth(1).click();
  const itemEl = page.locator('[data-section="0"] .item').nth(1);
  const paddingBefore = await itemEl.evaluate(el => parseInt(el.style.paddingLeft) || 12);
  await page.keyboard.press('Tab');
  expect(await itemEl.evaluate(el => parseInt(el.style.paddingLeft))).toBeGreaterThan(paddingBefore);
  await page.keyboard.press('Shift+Tab');
  expect(await itemEl.evaluate(el => parseInt(el.style.paddingLeft))).toBeLessThanOrEqual(paddingBefore);
});

test('backspace at cursor start outdents indented item', async ({ page }) => {
  // Child item at index 3 has indent 1
  await page.locator('[data-section="0"] .item-text').nth(3).click();
  await page.waitForTimeout(100);
  const childEl = page.locator('[data-section="0"] .item').nth(3);
  const padBefore = await childEl.evaluate(el => parseInt(el.style.paddingLeft));
  // Place cursor at start using Selection API (more reliable than Home key in contenteditable)
  await page.evaluate(() => {
    const edit = document.querySelector('.item-edit');
    const sel = window.getSelection();
    sel.selectAllChildren(edit);
    sel.collapseToStart();
  });
  await page.keyboard.press('Backspace');
  expect(await childEl.evaluate(el => parseInt(el.style.paddingLeft))).toBeLessThan(padBefore);
});
