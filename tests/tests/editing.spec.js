const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.section')).toHaveCount(2);
});

const WRAPPED_TEXT = 'This deliberately long todo item wraps across several rendered visual lines so arrow navigation follows the caret before moving between separate todo items.';

async function editWrappedItem(page, itemIndex) {
  await page.addStyleTag({ content: '.main { max-width: 260px !important; }' });
  const item = page.locator('[data-section="0"] .item').nth(itemIndex);
  await item.locator('.item-text').click();
  const edit = item.locator('.item-edit');
  await edit.fill(WRAPPED_TEXT);

  const lineCount = await edit.evaluate(input => {
    const contentRange = document.createRange();
    contentRange.selectNodeContents(input);
    const tops = Array.from(contentRange.getClientRects())
      .filter(rect => rect.height > 0)
      .map(rect => rect.top)
      .filter((top, index, all) => all.findIndex(candidate => Math.abs(candidate - top) < 2) === index);
    return tops.length;
  });
  expect(lineCount).toBeGreaterThanOrEqual(3);
  return edit;
}

async function placeCaretOnVisualLine(edit, line) {
  return edit.evaluate((input, requestedLine) => {
    const contentRange = document.createRange();
    contentRange.selectNodeContents(input);
    const rects = Array.from(contentRange.getClientRects())
      .filter(rect => rect.height > 0)
      .sort((a, b) => a.top - b.top || a.left - b.left);
    const lines = [];
    for (const rect of rects) {
      let visualLine = lines.find(candidate => Math.abs(candidate.top - rect.top) < 2);
      if (!visualLine) {
        visualLine = { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
        lines.push(visualLine);
      } else {
        visualLine.bottom = Math.max(visualLine.bottom, rect.bottom);
        visualLine.left = Math.min(visualLine.left, rect.left);
        visualLine.right = Math.max(visualLine.right, rect.right);
      }
    }

    const visualLine = requestedLine === 'first' ? lines[0] : lines.at(-1);
    const caretRange = document.caretRangeFromPoint(
      visualLine.left + Math.min(10, (visualLine.right - visualLine.left) / 2),
      visualLine.top + (visualLine.bottom - visualLine.top) / 2,
    );
    if (!caretRange || !input.contains(caretRange.startContainer)) {
      throw new Error(`Could not place caret on ${requestedLine} visual line`);
    }

    input.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(caretRange);
    return caretRange.getBoundingClientRect().top;
  }, line);
}

async function caretTop(edit) {
  return edit.evaluate(input => {
    const selection = window.getSelection();
    if (!selection.rangeCount || !input.contains(selection.anchorNode)) {
      throw new Error('Caret is no longer in the expected item');
    }
    return selection.getRangeAt(0).getBoundingClientRect().top;
  });
}

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

test('down moves within wrapped text before moving to the next item', async ({ page }) => {
  const edit = await editWrappedItem(page, 0);
  const firstLineTop = await placeCaretOnVisualLine(edit, 'first');

  await page.keyboard.press('ArrowDown');

  await expect(page.locator('[data-section="0"] .item').nth(0).locator('.item-edit')).toBeVisible();
  expect(await caretTop(edit)).toBeGreaterThan(firstLineTop + 1);

  await placeCaretOnVisualLine(edit, 'last');
  await page.keyboard.press('ArrowDown');

  await expect(page.locator('[data-section="0"] .item').nth(1).locator('.item-edit')).toBeVisible();
});

test('up moves within wrapped text before moving to the previous item', async ({ page }) => {
  const edit = await editWrappedItem(page, 1);
  const lastLineTop = await placeCaretOnVisualLine(edit, 'last');

  await page.keyboard.press('ArrowUp');

  await expect(page.locator('[data-section="0"] .item').nth(1).locator('.item-edit')).toBeVisible();
  expect(await caretTop(edit)).toBeLessThan(lastLineTop - 1);

  await placeCaretOnVisualLine(edit, 'first');
  await page.keyboard.press('ArrowUp');

  await expect(page.locator('[data-section="0"] .item').nth(0).locator('.item-edit')).toBeVisible();
});
