const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.section')).toHaveCount(2);
});

const WRAPPED_TEXT = 'This deliberately long todo item wraps across several rendered visual lines so arrow navigation follows the caret before moving between separate todo items.';
const MULTILINE_SELECTION_TEXT = `keep${'selected'.repeat(24)}stay`;

async function selectWrappedDisplayText(page) {
  await page.addStyleTag({ content: '.main { max-width: 260px !important; }' });
  await page.evaluate(text => {
    window._todoState.data.sections[0].items[0].text = text;
    window.render();
  }, MULTILINE_SELECTION_TEXT);

  return page.locator('[data-section="0"] .item').first().locator('.item-text').evaluate(display => {
    const textNode = display.firstChild;
    const range = document.createRange();
    range.setStart(textNode, 4);
    range.setEnd(textNode, textNode.length - 4);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const lineTops = Array.from(range.getClientRects())
      .filter(rect => rect.height > 0)
      .map(rect => rect.top)
      .filter((top, index, all) => all.findIndex(candidate => Math.abs(candidate - top) < 2) === index);
    const selectedText = selection.toString();
    display.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { lineCount: lineTops.length, selectedText };
  });
}

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

const WRAPPED_RICH_TEXT = 'Opening words occupy several rendered lines before the **strong boundary marker** with surrounding text that keeps [linked boundary marker](https://example.com) away from both outer visual lines, followed by plenty of trailing words to ensure multiple rendered lines remain below every inline element in this todo item.';

async function editWrappedRichItem(page) {
  await page.addStyleTag({ content: '.main { max-width: 260px !important; }' });
  await page.evaluate(text => {
    window._todoState.data.sections[0].items[1].text = text;
    window.render();
  }, WRAPPED_RICH_TEXT);
  const item = page.locator('[data-section="0"] .item').nth(1);
  await item.locator('.item-text').click({ position: { x: 5, y: 5 } });
  return item.locator('.item-edit');
}

async function placeCaretAtNestedEnd(edit, selector) {
  return edit.evaluate((input, nestedSelector) => {
    const element = input.querySelector(nestedSelector);
    if (!element || !element.childNodes.length) throw new Error(`Missing ${nestedSelector} content`);

    const contentRange = document.createRange();
    contentRange.selectNodeContents(input);
    const lineTops = Array.from(contentRange.getClientRects())
      .filter(rect => rect.height > 0)
      .map(rect => rect.top)
      .filter((top, index, all) => all.findIndex(candidate => Math.abs(candidate - top) < 2) === index);
    const elementRange = document.createRange();
    elementRange.selectNodeContents(element);
    const elementTops = Array.from(elementRange.getClientRects())
      .filter(rect => rect.height > 0)
      .map(rect => rect.top)
      .sort((a, b) => a - b);
    const caretRange = document.createRange();
    caretRange.setStart(element, element.childNodes.length);
    caretRange.collapse(true);
    input.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(caretRange);
    return {
      boundaryTop: elementTops.at(-1),
      caretHeight: caretRange.getBoundingClientRect().height,
      containerTag: caretRange.startContainer.tagName,
      firstLineTop: Math.min(...lineTops),
      lastLineTop: Math.max(...lineTops),
      lineCount: lineTops.length,
    };
  }, selector);
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

for (const key of ['Backspace', 'Delete']) {
  test(`${key} removes a multiline selection made before entering edit mode`, async ({ page }) => {
    const before = await selectWrappedDisplayText(page);
    expect(before.lineCount).toBeGreaterThan(1);

    const edit = page.locator('[data-section="0"] .item').first().locator('.item-edit');
    await expect(edit).toBeVisible();
    expect(await page.evaluate(() => window.getSelection().toString())).toBe(before.selectedText);

    await page.keyboard.press(key);

    await expect(edit).toHaveText('keepstay');
  });
}

test('cmd+z undoes a structural deletion while another item is focused and cmd+shift+z redoes it', async ({ page }) => {
  const items = page.locator('[data-section="0"] .item');
  await items.nth(0).locator('.item-text').click();
  await items.nth(2).locator('.delete-btn').click();

  await expect(items).toHaveCount(4);
  await expect(items.nth(0).locator('.item-edit')).toBeVisible();

  await page.keyboard.press('Meta+z');
  await expect(items).toHaveCount(7);
  await expect(items.nth(2).locator('.item-text')).toContainText('parent item');
  await expect(items.nth(3).locator('.item-text')).toContainText('child item');
  await expect(items.nth(4).locator('.item-text')).toContainText('another child');

  await page.keyboard.press('Meta+Shift+z');
  await expect(items).toHaveCount(4);
});

test('cmd+z uses native undo for unsaved text edits', async ({ page }) => {
  const firstItem = page.locator('[data-section="0"] .item').nth(0);
  await firstItem.locator('.item-text').click();
  await page.keyboard.press('End');
  await page.keyboard.insertText(' updated');
  await expect(firstItem.locator('.item-edit')).toHaveText('first item updated');

  await page.keyboard.press('Meta+z');
  await expect(firstItem.locator('.item-edit')).toHaveText('first item');

  await page.keyboard.press('Meta+Shift+z');
  await expect(firstItem.locator('.item-edit')).toHaveText('first item updated');
});

test('cmd+z undoes an outdent before the preceding text edit', async ({ page }) => {
  const childItem = page.locator('[data-section="0"] .item').nth(3);
  await childItem.locator('.item-text').click();
  await page.keyboard.press('Home');
  await page.keyboard.insertText('updated ');
  const editedText = (await childItem.locator('.item-edit').textContent()).trim();
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  expect(await page.evaluate(() => window._todoState.data.sections[0].items[3].indent)).toBe(0);

  await page.keyboard.press('Meta+z');
  expect(await page.evaluate(() => window._todoState.data.sections[0].items[3].indent)).toBe(1);
  await expect(childItem.locator('.item-text')).toHaveText(editedText);
});

test('enter at end creates item below', async ({ page }) => {
  const countBefore = await page.locator('[data-section="0"] .item').count();
  await page.locator('.item-text').first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-section="0"] .item')).toHaveCount(countBefore + 1);
  await expect(page.locator('[data-section="0"] .item').nth(1).locator('.item-edit')).toBeVisible();
});

test('enter on a parent creates a new child directly underneath', async ({ page }) => {
  const items = page.locator('[data-section="0"] .item');
  await items.nth(2).locator('.item-text').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');

  await expect(items).toHaveCount(8);
  await expect(items.nth(3).locator('.item-edit')).toBeVisible();
  expect(await page.evaluate(() => window._todoState.data.sections[0].items[3].indent)).toBe(1);
  await expect(items.nth(4).locator('.item-text')).toContainText('child item');
  await expect(items.nth(5).locator('.item-text')).toContainText('another child');
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

test('down enters the next wrapped item at its start', async ({ page }) => {
  await page.addStyleTag({ content: '.main { max-width: 260px !important; }' });
  await page.evaluate(text => {
    window._todoState.data.sections[0].items[0].text = text;
    window._todoState.data.sections[0].items[1].text = text;
    window.render();
  }, WRAPPED_TEXT);

  const sourceItem = page.locator('[data-section="0"] .item').nth(0);
  await sourceItem.locator('.item-text').click();
  await placeCaretOnVisualLine(sourceItem.locator('.item-edit'), 'last');
  await page.keyboard.press('ArrowDown');

  const destinationEdit = page.locator('[data-section="0"] .item').nth(1).locator('.item-edit');
  await expect(destinationEdit).toBeVisible();
  const caret = await destinationEdit.evaluate(input => {
    const contentRange = document.createRange();
    contentRange.selectNodeContents(input);
    const lineTops = Array.from(contentRange.getClientRects())
      .filter(rect => rect.height > 0)
      .map(rect => rect.top)
      .filter((top, index, all) => all.findIndex(candidate => Math.abs(candidate - top) < 2) === index);
    const selection = window.getSelection();
    const beforeCaret = document.createRange();
    beforeCaret.selectNodeContents(input);
    beforeCaret.setEnd(selection.anchorNode, selection.anchorOffset);
    return { lineCount: lineTops.length, textBeforeCaret: beforeCaret.toString() };
  });
  expect(caret.lineCount).toBeGreaterThanOrEqual(3);
  expect(caret.textBeforeCaret).toBe('');
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

test('up from the natural end caret stays within wrapped text', async ({ page }) => {
  const wrappedRichText = `${WRAPPED_TEXT} It also contains **strong words** and ends with [a link](https://example.com)`;
  await page.addStyleTag({ content: '.main { max-width: 260px !important; }' });
  await page.evaluate(text => {
    window._todoState.data.sections[0].items[1].text = text;
    window.render();
  }, wrappedRichText);

  const item = page.locator('[data-section="0"] .item').nth(1);
  await item.locator('.item-text').click();
  const edit = item.locator('.item-edit');
  const geometry = await edit.evaluate(input => {
    const contentRange = document.createRange();
    contentRange.selectNodeContents(input);
    const lineTops = Array.from(contentRange.getClientRects())
      .filter(rect => rect.height > 0)
      .map(rect => rect.top)
      .filter((top, index, all) => all.findIndex(candidate => Math.abs(candidate - top) < 2) === index);
    return {
      caretHeight: window.getSelection().getRangeAt(0).getBoundingClientRect().height,
      lineCount: lineTops.length,
      lastLineTop: Math.max(...lineTops),
    };
  });
  expect(geometry.lineCount).toBeGreaterThanOrEqual(3);
  expect(geometry.caretHeight).toBe(0);

  await page.keyboard.press('ArrowUp');

  await expect(item.locator('.item-edit')).toBeVisible();
  expect(await caretTop(edit)).toBeLessThan(geometry.lastLineTop - 1);
});

test('shift+down extends selection within a wrapped item', async ({ page }) => {
  const edit = await editWrappedItem(page, 0);
  await placeCaretOnVisualLine(edit, 'first');

  await page.keyboard.press('Shift+ArrowDown');

  await expect(page.locator('[data-section="0"] .item').nth(0).locator('.item-edit')).toBeVisible();
  const selection = await edit.evaluate(input => {
    const current = window.getSelection();
    return {
      collapsed: current.isCollapsed,
      insideItem: input.contains(current.anchorNode) && input.contains(current.focusNode),
      text: current.toString(),
    };
  });
  expect(selection.insideItem).toBe(true);
  expect(selection.collapsed).toBe(false);
  expect(selection.text.length).toBeGreaterThan(0);
});

test('arrow keys navigate across section boundaries and preserve edits', async ({ page }) => {
  const sectionZeroItems = page.locator('[data-section="0"] .item');
  const lastItemIndex = await sectionZeroItems.count() - 1;
  const lastItem = sectionZeroItems.nth(lastItemIndex);
  await lastItem.locator('.item-text').click();
  const lastEdit = lastItem.locator('.item-edit');
  await lastEdit.fill('edited last item is preserved');
  await placeCaretOnVisualLine(lastEdit, 'last');

  await page.keyboard.press('ArrowDown');

  const nextSectionEdit = page.locator('[data-section="1"] .item').nth(0).locator('.item-edit');
  await expect(nextSectionEdit).toBeVisible();
  await placeCaretOnVisualLine(nextSectionEdit, 'first');

  await page.keyboard.press('ArrowUp');

  const returnedEdit = page.locator('[data-section="0"] .item').nth(lastItemIndex).locator('.item-edit');
  await expect(returnedEdit).toBeVisible();
  await expect(returnedEdit).toHaveText('edited last item is preserved');
});

test('strong element boundary moves natively within wrapped text', async ({ page }) => {
  const edit = await editWrappedRichItem(page);
  const geometry = await placeCaretAtNestedEnd(edit, 'strong');
  expect(geometry.lineCount).toBeGreaterThanOrEqual(3);
  expect(geometry.caretHeight).toBe(0);
  expect(geometry.containerTag).toBe('STRONG');
  expect(geometry.boundaryTop).toBeGreaterThan(geometry.firstLineTop + 1);
  expect(geometry.boundaryTop).toBeLessThan(geometry.lastLineTop - 1);

  await page.keyboard.press('ArrowDown');

  await expect(page.locator('[data-section="0"] .item').nth(1).locator('.item-edit')).toBeVisible();
  expect(await caretTop(edit)).toBeGreaterThan(geometry.boundaryTop + 1);
});

test('link element boundary moves natively within wrapped text', async ({ page }) => {
  const edit = await editWrappedRichItem(page);
  const geometry = await placeCaretAtNestedEnd(edit, 'a');
  expect(geometry.lineCount).toBeGreaterThanOrEqual(3);
  expect(geometry.caretHeight).toBe(0);
  expect(geometry.containerTag).toBe('A');
  expect(geometry.boundaryTop).toBeGreaterThan(geometry.firstLineTop + 1);
  expect(geometry.boundaryTop).toBeLessThan(geometry.lastLineTop - 1);

  await page.keyboard.press('ArrowUp');

  await expect(page.locator('[data-section="0"] .item').nth(1).locator('.item-edit')).toBeVisible();
  expect(await caretTop(edit)).toBeLessThan(geometry.boundaryTop - 1);
});
