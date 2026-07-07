const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.section')).toHaveCount(2);
});

test('checking item persists to data model', async ({ page }) => {
  await page.locator('[data-section="0"] .item').first().locator('.checkbox').click();
  await page.waitForTimeout(200);
  const md = await page.evaluate(() => window._todoSerialize(window._todoState.data));
  expect(md).toContain('- [x] first item');
});

test('blur on empty does not delete item', async ({ page }) => {
  const countBefore = await page.locator('[data-section="0"] .item').count();
  await page.locator('[data-section="0"] .item-text').first().click();
  // Clear the edit
  await page.evaluate(() => {
    const edit = document.querySelector('.item-edit');
    edit.textContent = '';
  });
  // Blur by clicking header
  await page.locator('.header').click();
  await page.waitForTimeout(100);
  // Item should still exist (not deleted by blur)
  await expect(page.locator('[data-section="0"] .item')).toHaveCount(countBefore);
});

test('editing one item does not corrupt other items', async ({ page }) => {
  // Edit first item
  await page.locator('[data-section="0"] .item-text').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' modified');
  await page.locator('.header').click();
  await page.waitForTimeout(100);
  // All other items should be intact
  const md = await page.evaluate(() => window._todoSerialize(window._todoState.data));
  expect(md).toContain('- [ ] first item modified');
  expect(md).toContain('- [ ] parent item');
  expect(md).toContain('    - [ ] child item');
  expect(md).toContain('    - [ ] another child');
  expect(md).toContain('- [x] already done');
  expect(md).toContain('- [ ] last unchecked');
  expect(md).toContain('[a link](https://example.com)');
});

test('rapid check then edit does not lose data', async ({ page }) => {
  // Check first item
  await page.locator('[data-section="0"] .item').first().locator('.checkbox').click();
  // Immediately click to edit second item
  await page.locator('[data-section="0"] .item-text').nth(1).click();
  await page.waitForTimeout(200);
  // First item should still be checked, second should still have its text
  const md = await page.evaluate(() => window._todoSerialize(window._todoState.data));
  expect(md).toContain('- [x] first item');
  expect(md).toContain('[a link](https://example.com)');
});

test('delete highlighted text with backspace works', async ({ page }) => {
  await page.locator('[data-section="0"] .item-text').first().click();
  // Select all text
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  // Should have empty edit, not crash
  const text = await page.locator('.item-edit').textContent();
  expect(text.trim()).toBe('');
});
