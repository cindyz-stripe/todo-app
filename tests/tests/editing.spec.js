const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.section')).toHaveCount(2);
});

test('click to edit, blur saves, escape cancels', async ({ page }) => {
  await page.locator('.item-text').first().click();
  await expect(page.locator('.item-edit')).toHaveCount(1);
  // Escape cancels
  await page.keyboard.press('Escape');
  await expect(page.locator('.item-edit')).toHaveCount(0);
  await expect(page.locator('.item-text').first()).toContainText('first item');
  // Edit and blur saves
  await page.locator('.item-text').first().click();
  const edit = page.locator('.item-edit');
  await edit.fill('');
  await edit.pressSequentially('updated text');
  await page.locator('.header').click();
  await expect(page.locator('.item-text').first()).toContainText('updated text');
});

test('enter at end creates item below', async ({ page }) => {
  const countBefore = await page.locator('[data-section="0"] .item').count();
  await page.locator('.item-text').first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-section="0"] .item')).toHaveCount(countBefore + 1);
  await expect(page.locator('[data-section="0"] .item').nth(1).locator('.item-edit')).toBeVisible();
});

test('enter at beginning creates item above', async ({ page }) => {
  await page.locator('.item-text').first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-section="0"] .item').nth(0).locator('.item-edit')).toBeVisible();
  await expect(page.locator('[data-section="0"] .item').nth(1).locator('.item-text')).toContainText('first item');
});

test('enter on empty item at indent 0 deletes, at indent >0 outdents', async ({ page }) => {
  // Create indented empty item
  await page.locator('[data-section="0"] .item-text').nth(1).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  const itemEl = page.locator('[data-section="0"] .item').nth(2);
  const paddingIndented = await itemEl.evaluate(el => parseInt(el.style.paddingLeft));
  // Enter on empty indented → outdent
  await page.keyboard.press('Enter');
  const paddingAfter = await itemEl.evaluate(el => parseInt(el.style.paddingLeft));
  expect(paddingAfter).toBeLessThan(paddingIndented);
  // Enter again on empty at indent 0 → delete
  const countBefore = await page.locator('[data-section="0"] .item').count();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-section="0"] .item')).toHaveCount(countBefore - 1);
});
