# Checkbox Celebration and Arrow Navigation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `$executing-plans` to implement this plan task-by-task.

**Goal:** Make each checkbox celebration use one randomly selected emoji while consecutive celebrations differ, and preserve native Up/Down movement inside wrapped todo text until the caret reaches a visual boundary.

**Architecture:** Keep the single-file application structure. Add one small stateful emoji selector and one DOM-range helper that identifies whether the contenteditable caret is on its first or last rendered line; gate the existing cross-item navigation with that helper.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Chrome File System Access API, Playwright

---

### Task 1: Point Playwright at the repository app

**Files:**
- Modify: `tests/playwright.config.js`

**Step 1: Replace the hard-coded duplicate-file URL**

Import Node's path and URL helpers and build `baseURL` from the checked-out repository:

```js
const path = require('path');
const { pathToFileURL } = require('url');

const appURL = pathToFileURL(path.resolve(__dirname, '../todo.html')).href + '?test';
```

Set `use.baseURL` to `appURL`.

**Step 2: Run the existing suite against the repository file**

Run: `cd tests && npx playwright test`

Expected: 13 tests pass.

**Step 3: Commit**

```bash
git add tests/playwright.config.js
git commit -m "Test the repository todo app"
```

### Task 2: Use one random emoji per celebration

**Files:**
- Modify: `tests/tests/checkboxes.spec.js`
- Modify: `todo.html:1090-1140`

**Step 1: Write failing celebration tests**

Add one test that installs a changing `Math.random`, checks a todo, and verifies all three `.sparkle` elements have one unique `textContent` value:

```js
test('one check uses the same emoji for every sparkle', async ({ page }) => {
  await page.evaluate(() => {
    let next = 0;
    Math.random = () => (next++ % 10) / 10;
  });

  await page.locator('[data-section="0"] .item').first().locator('.checkbox').click();

  const emojis = await page.locator('[data-section="0"] .item').first().locator('.sparkle').allTextContents();
  expect(new Set(emojis).size).toBe(1);
});
```

Add a second test that fixes `Math.random` at zero, checks two different todos, and verifies their bursts use different emojis:

```js
test('consecutive checks choose different celebration emojis', async ({ page }) => {
  await page.evaluate(() => { Math.random = () => 0; });
  const items = page.locator('[data-section="0"] .item');

  await items.nth(0).locator('.checkbox').click();
  await items.nth(1).locator('.checkbox').click();

  const firstEmoji = await items.nth(0).locator('.sparkle').first().textContent();
  const secondEmoji = await items.nth(1).locator('.sparkle').first().textContent();
  expect(secondEmoji).not.toBe(firstEmoji);
});
```

**Step 2: Run the tests to verify RED**

Run: `cd tests && npx playwright test tests/checkboxes.spec.js`

Expected: both new tests fail against the current per-particle selection logic.

**Step 3: Implement the minimal emoji selector**

Move the emoji list to a constant, remember only the previous burst, and select from a list that excludes it:

```js
const SPARKLE_EMOJIS = ['✨', '⭐', '💫', '🌸', '🎀', '💖', '🦋', '🍡', '🧁', '🌈', '💐', '🎉', '🪷', '🫧', '☁️', '🍓', '🌷', '💝', '🎊', '✿'];
let previousSparkleEmoji = null;

function chooseSparkleEmoji() {
    const choices = SPARKLE_EMOJIS.filter(emoji => emoji !== previousSparkleEmoji);
    previousSparkleEmoji = choices[Math.floor(Math.random() * choices.length)];
    return previousSparkleEmoji;
}
```

In `toggleCheck`, call `chooseSparkleEmoji()` once before the three-particle loop and assign that value to every particle.

**Step 4: Run the focused test to verify GREEN**

Run: `cd tests && npx playwright test tests/checkboxes.spec.js`

Expected: all checkbox tests pass.

**Step 5: Commit**

```bash
git add todo.html tests/tests/checkboxes.spec.js
git commit -m "Use one emoji per todo celebration"
```

### Task 3: Respect visual lines during arrow navigation

**Files:**
- Modify: `tests/tests/editing.spec.js`
- Modify: `todo.html:1427-1531`

**Step 1: Write failing multiline navigation tests**

Add a test helper that replaces an item's text with a long wrapping sentence, narrows `.main`, enters edit mode, and places the caret on a rendered line with `document.caretRangeFromPoint`.

Add focused assertions for these behaviors:

```js
test('down moves within wrapped text before moving to the next item', async ({ page }) => {
  // Arrange a three-line first item and place the caret on its first visual line.
  // Press ArrowDown and assert the active `.item-edit` still belongs to item 0
  // and the caret rectangle moved to a larger `top` value.
  // Place the caret on the final visual line, press ArrowDown, and assert item 1 is editing.
});

test('up moves within wrapped text before moving to the previous item', async ({ page }) => {
  // Arrange a three-line second item and place the caret on its final visual line.
  // Press ArrowUp and assert the active `.item-edit` still belongs to item 1
  // and the caret rectangle moved to a smaller `top` value.
  // Place the caret on the first visual line, press ArrowUp, and assert item 0 is editing.
});
```

Use rendered rectangles rather than character offsets so the tests exercise visual wrapping, which is the reported behavior.

**Step 2: Run the tests to verify RED**

Run: `cd tests && npx playwright test tests/editing.spec.js`

Expected: the new tests fail because the current `editKeydown` always switches items on unmodified Up/Down.

**Step 3: Add visual-boundary detection**

Add a helper before `editKeydown`:

```js
function isCaretOnVisualBoundary(input, direction) {
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed || !input.contains(sel.anchorNode)) return false;

    const caretRect = sel.getRangeAt(0).getBoundingClientRect();
    const contentRange = document.createRange();
    contentRange.selectNodeContents(input);
    const lineRects = Array.from(contentRange.getClientRects()).filter(rect => rect.height > 0);
    if (!lineRects.length || caretRect.height === 0) return true;

    const boundaryTop = direction === 'up'
        ? Math.min(...lineRects.map(rect => rect.top))
        : Math.max(...lineRects.map(rect => rect.top));
    return Math.abs(caretRect.top - boundaryTop) < 2;
}
```

Gate the existing branches without changing their save/focus behavior:

```js
} else if (e.key === 'ArrowUp' && !e.shiftKey && isCaretOnVisualBoundary(input, 'up')) {
```

```js
} else if (e.key === 'ArrowDown' && !e.shiftKey && isCaretOnVisualBoundary(input, 'down')) {
```

When the helper returns false, do not prevent the event; Chrome performs native movement to the next rendered line.

**Step 4: Run the focused test to verify GREEN**

Run: `cd tests && npx playwright test tests/editing.spec.js`

Expected: all editing tests pass.

**Step 5: Commit**

```bash
git add todo.html tests/tests/editing.spec.js
git commit -m "Respect wrapped lines during arrow navigation"
```

### Task 4: Verify the complete change

**Files:**
- Verify: `todo.html`
- Verify: `tests/tests/*.spec.js`

**Step 1: Run the full Playwright suite**

Run: `cd tests && npx playwright test`

Expected: all tests pass without failures.

**Step 2: Review the final diff**

Run: `git diff HEAD~2 --check && git status --short`

Expected: no whitespace errors and a clean worktree.

