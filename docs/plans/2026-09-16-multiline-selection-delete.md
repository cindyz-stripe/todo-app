# Multiline Selection Delete Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `$executing-plans` to implement this plan task-by-task.

**Goal:** Preserve a multiline display-mode text selection when a todo enters edit mode so Backspace and forward Delete remove that selection normally.

**Architecture:** Capture a non-collapsed selection as text offsets before `startEdit` replaces `.item-text`, then resolve those offsets against the new editor's text nodes and restore the range. Leave native deletion and undo untouched; ordinary clicks retain end-caret placement.

**Tech Stack:** Single-file HTML/CSS/JavaScript app, DOM Range/Selection APIs, Playwright.

---

### Task 1: Preserve selection through the display-to-editor transition

**Files:**
- Modify: `tests/tests/editing.spec.js`
- Modify: `todo.html`

**Step 1: Write failing Backspace and Delete regressions**

Add a helper that creates a wrapped, non-collapsed selection while the item is still in display mode, verifies that the range spans multiple rendered lines, and dispatches the click that currently calls `startEdit`:

```js
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
```

Add parameterized tests for Backspace and forward Delete:

```js
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
```

**Step 2: Run the focused tests and verify RED**

Run:

```bash
cd tests
npx playwright test tests/editing.spec.js -g "removes a multiline selection made before entering edit mode"
```

Expected: both tests fail because `startEdit` collapses the selection to the editor's end instead of restoring the selected text.

**Step 3: Add offset capture and restoration helpers**

Near the editing helpers in `todo.html`, add:

```js
function selectionOffsetsWithin(element) {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) return null;
    const selectedRange = selection.getRangeAt(0);
    if (!element.contains(selectedRange.startContainer) || !element.contains(selectedRange.endContainer)) return null;

    const prefix = document.createRange();
    prefix.selectNodeContents(element);
    prefix.setEnd(selectedRange.startContainer, selectedRange.startOffset);
    const throughSelection = document.createRange();
    throughSelection.selectNodeContents(element);
    throughSelection.setEnd(selectedRange.endContainer, selectedRange.endOffset);
    return { start: prefix.toString().length, end: throughSelection.toString().length };
}

function textPositionAtOffset(element, offset) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (remaining <= node.nodeValue.length) return { node, offset: remaining };
        remaining -= node.nodeValue.length;
    }
    return { node: element, offset: element.childNodes.length };
}

function restoreSelectionFromOffsets(element, offsets) {
    const start = textPositionAtOffset(element, offsets.start);
    const end = textPositionAtOffset(element, offsets.end);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}
```

**Step 4: Preserve the selection in `startEdit`**

Extend the signature so recursive re-entry can carry offsets:

```js
function startEdit(si, ii, caretPlacement = 'end', selectedOffsets) {
```

Before clearing/changing the current DOM, capture offsets only when none were supplied:

```js
if (selectedOffsets === undefined) {
    const display = document.querySelector(`.item[data-section="${si}"][data-index="${ii}"] .item-text`);
    selectedOffsets = display ? selectionOffsetsWithin(display) : null;
}
```

Pass `selectedOffsets` through the existing recursive `startEdit` call. After focusing the new `.item-edit`, restore a captured selection; otherwise keep existing caret placement:

```js
if (selectedOffsets) {
    restoreSelectionFromOffsets(inp, selectedOffsets);
} else {
    const sel = window.getSelection();
    sel.selectAllChildren(inp);
    if (caretPlacement === 'start') sel.collapseToStart();
    else sel.collapseToEnd();
}
```

Do not add custom Backspace/Delete handling.

**Step 5: Run focused tests and verify GREEN**

Run:

```bash
cd tests
npx playwright test tests/editing.spec.js -g "removes a multiline selection made before entering edit mode"
```

Expected: 2 tests pass.

**Step 6: Run editing and full suites**

Run:

```bash
cd tests
npx playwright test tests/editing.spec.js
npx playwright test
```

Expected: all tests pass.

**Step 7: Commit**

```bash
git add todo.html tests/tests/editing.spec.js
git commit -m "Preserve multiline selections when editing"
```

### Task 2: Final review and synchronization

**Files:**
- Verify: `todo.html`
- Verify: `tests/tests/editing.spec.js`

**Step 1: Review and verify**

Run:

```bash
git diff --check main...HEAD
git status --short --branch
git diff main...HEAD -- todo.html tests/tests/editing.spec.js
cd tests && npx playwright test
```

Expected: no whitespace errors, a clean feature branch, only the approved selection behavior, and all tests passing.

**Step 2: Integrate**

Use `$finishing-a-development-branch` to merge into local `main`. Rerun the full suite on merged `main`, update `/Users/cindyz/todo.html` to match the repository copy, verify byte equality, push `main` to the configured GitHub remote, then clean up the merged branch and worktree.
