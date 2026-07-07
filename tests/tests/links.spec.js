const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.section')).toHaveCount(2);
});

test('links render styled in both display and edit mode', async ({ page }) => {
  // Display mode — clickable link
  const link = page.locator('[data-section="0"] .item').nth(1).locator('.item-text a');
  await expect(link).toHaveAttribute('href', 'https://example.com');
  // Edit mode — styled <a>, not raw markdown
  await page.locator('[data-section="0"] .item-text').nth(1).click();
  const editLink = page.locator('.item-edit a');
  await expect(editLink).toHaveCount(1);
  const text = await page.locator('.item-edit').textContent();
  expect(text).not.toContain('](');
});

test('paste URL creates link, backspace inside link unlinks', async ({ page }) => {
  // Paste URL with selection wraps as link
  await page.locator('[data-section="0"] .item-text').first().click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.evaluate(() => {
    const edit = document.querySelector('.item-edit');
    const dt = new DataTransfer();
    dt.setData('text/plain', 'https://wrapped.example.com');
    edit.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.locator('.item-edit a[href="https://wrapped.example.com"]')).toContainText('first');
  // Backspace unlinks
  await page.keyboard.press('Escape');
  await page.locator('[data-section="0"] .item-text').nth(1).click();
  await page.keyboard.press('Home');
  for (let i = 0; i < 19; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Backspace');
  await expect(page.locator('.item-edit a')).toHaveCount(0);
  const text = await page.locator('.item-edit').textContent();
  expect(text).toContain('a link');
});
