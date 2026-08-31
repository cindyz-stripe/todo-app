# Caret and Celebration Polish Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `$executing-plans` to implement this plan task-by-task.

**Goal:** Place the caret at the first line when ArrowDown enters a wrapped todo and replace the straight emoji rise with a subtle, accessible three-way fan and checkbox glow.

**Architecture:** Extend `startEdit` with a defaulted caret-placement argument so existing callers retain end placement while ArrowDown explicitly requests start placement. Keep the existing emoji-selection logic and drive three deterministic particle paths through CSS custom properties; CSS owns animation and reduced-motion behavior.

**Tech Stack:** Single-file HTML/CSS/JavaScript app, Playwright, CommonJS.

---

### Task 1: ArrowDown enters a wrapped todo at its start

**Files:**
- Modify: `tests/tests/editing.spec.js`
- Modify: `todo.html`

**Step 1: Write the failing regression test**

Add a test that renders two adjacent wrapped items before entering edit mode, places the caret on the last visual line of the first, presses ArrowDown, and verifies the destination has multiple visual lines with no text before the caret:

```js
test('down enters the next wrapped item on its first line', async ({ page }) => {
  await page.addStyleTag({ content: '.main { max-width: 260px !important; }' });
  await page.evaluate(text => {
    window._todoState.data.sections[0].items[0].text = text;
    window._todoState.data.sections[0].items[1].text = text;
    window.render();
  }, WRAPPED_TEXT);

  const items = page.locator('[data-section="0"] .item');
  await items.nth(0).locator('.item-text').click();
  await placeCaretOnVisualLine(items.nth(0).locator('.item-edit'), 'last');
  await page.keyboard.press('ArrowDown');

  const destination = items.nth(1).locator('.item-edit');
  await expect(destination).toBeVisible();
  const geometry = await destination.evaluate(input => {
    const selection = window.getSelection();
    const caretRange = selection.getRangeAt(0);
    const prefixRange = document.createRange();
    prefixRange.selectNodeContents(input);
    prefixRange.setEnd(caretRange.startContainer, caretRange.startOffset);
    const contentRange = document.createRange();
    contentRange.selectNodeContents(input);
    const lineTops = Array.from(contentRange.getClientRects())
      .filter(rect => rect.height > 0)
      .map(rect => rect.top)
      .filter((top, index, all) => all.findIndex(candidate => Math.abs(candidate - top) < 2) === index);
    return { lineCount: lineTops.length, textBeforeCaret: prefixRange.toString() };
  });
  expect(geometry.lineCount).toBeGreaterThanOrEqual(3);
  expect(geometry.textBeforeCaret).toBe('');
});
```

**Step 2: Run the test and verify RED**

Run:

```bash
cd tests
npx playwright test tests/editing.spec.js -g "down enters the next wrapped item"
```

Expected: FAIL because `startEdit` currently collapses every new selection to the end.

**Step 3: Implement the minimal direction-aware placement**

Change the signature and final selection setup:

```js
function startEdit(si, ii, caretPlacement = 'end') {
    // existing body
    sel.selectAllChildren(inp);
    if (caretPlacement === 'start') sel.collapseToStart();
    else sel.collapseToEnd();
}
```

Pass `caretPlacement` through the recursive `startEdit` call used after removing an empty previous item. Change only the ArrowDown transition to:

```js
startEdit(targetSi, targetIi, 'start');
```

Leave click, Enter, and ArrowUp callers unchanged.

**Step 4: Run focused and navigation tests and verify GREEN**

Run:

```bash
cd tests
npx playwright test tests/editing.spec.js
```

Expected: all editing tests pass, including the new regression.

**Step 5: Commit**

```bash
git add todo.html tests/tests/editing.spec.js
git commit -m "Place caret at start when moving down"
```

### Task 2: Add a subtle three-way emoji fan and glow

**Files:**
- Modify: `tests/tests/checkboxes.spec.js`
- Modify: `todo.html`

**Step 1: Write the failing fan and semantics test**

Add a test that checks one todo and asserts the three particles are decorative, have left/center/right travel, and activate the wrapper glow:

```js
test('completion emojis fan outward with a subtle glow', async ({ page }) => {
  const item = page.locator('[data-section="0"] .item').first();
  await item.locator('.checkbox').click();

  const sparkles = item.locator('.sparkle');
  await expect(sparkles).toHaveCount(3);
  expect(await sparkles.evaluateAll(nodes => nodes.map(node => node.style.getPropertyValue('--sparkle-x'))))
    .toEqual(['-28px', '0px', '28px']);
  expect(await sparkles.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-hidden'))))
    .toEqual(['true', 'true', 'true']);
  await expect(item.locator('.checkbox-wrapper')).toHaveClass(/celebrating/);
});
```

**Step 2: Run the test and verify RED**

Run:

```bash
cd tests
npx playwright test tests/checkboxes.spec.js -g "fan outward"
```

Expected: FAIL because the current particles have randomized starting positions, no fan variables, no decorative attribute, and no glow class.

**Step 3: Implement the particle data and glow lifecycle**

Define three fixed paths near `SPARKLE_EMOJIS`:

```js
const SPARKLE_PATHS = [
    { x: '-28px', y: '-40px', rotate: '-15deg', scale: '0.9', delay: '0ms' },
    { x: '0px', y: '-52px', rotate: '0deg', scale: '1.05', delay: '70ms' },
    { x: '28px', y: '-40px', rotate: '15deg', scale: '0.9', delay: '140ms' },
];
```

When checking, add `celebrating` to the wrapper, remove it after the animation, and assign each path to the corresponding particle using `--sparkle-x`, `--sparkle-y`, `--sparkle-rotate`, and `--sparkle-scale`. Set `aria-hidden="true"` and use the path delay instead of the current 150ms delay. Keep `chooseSparkleEmoji` unchanged.

Update `.checkbox-wrapper` to `position: relative`, add a pastel `::after` glow for `.celebrating`, and replace `sparkleUp` with a `sparkleFan` animation that interpolates from the checkbox to the custom-property endpoint with a small mid-flight overshoot. Keep particles absolutely positioned and non-interactive.

**Step 4: Run checkbox tests and verify GREEN**

Run:

```bash
cd tests
npx playwright test tests/checkboxes.spec.js
```

Expected: all checkbox tests pass.

**Step 5: Commit**

```bash
git add todo.html tests/tests/checkboxes.spec.js
git commit -m "Add subtle emoji fan celebration"
```

### Task 3: Respect reduced-motion preferences

**Files:**
- Modify: `tests/tests/checkboxes.spec.js`
- Modify: `todo.html`

**Step 1: Write the failing reduced-motion test**

```js
test('reduced motion uses a simple celebration fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const item = page.locator('[data-section="0"] .item').first();
  await item.locator('.checkbox').click();

  const animationNames = await item.evaluate(element => ({
    checkbox: getComputedStyle(element.querySelector('.checkbox')).animationName,
    sparkle: getComputedStyle(element.querySelector('.sparkle')).animationName,
    glow: getComputedStyle(element.querySelector('.checkbox-wrapper'), '::after').animationName,
  }));
  expect(animationNames).toEqual({ checkbox: 'none', sparkle: 'sparkleFade', glow: 'none' });
});
```

**Step 2: Run the test and verify RED**

Run:

```bash
cd tests
npx playwright test tests/checkboxes.spec.js -g "reduced motion"
```

Expected: FAIL because no reduced-motion styles exist.

**Step 3: Add the reduced-motion CSS fallback**

Add a short opacity-only keyframe and media query:

```css
@keyframes sparkleFade {
    from { opacity: 1; }
    to { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
    .checkbox.just-checked { animation: none; }
    .checkbox-wrapper.celebrating::after { animation: none; }
    .sparkle { animation-name: sparkleFade; animation-duration: 400ms; }
}
```

**Step 4: Run checkbox tests and the full suite**

Run:

```bash
cd tests
npx playwright test tests/checkboxes.spec.js
npx playwright test
```

Expected: all tests pass with no failures.

**Step 5: Commit**

```bash
git add todo.html tests/tests/checkboxes.spec.js
git commit -m "Respect reduced motion for celebrations"
```

### Task 4: Final verification and synchronization

**Files:**
- Verify: `todo.html`
- Verify: `tests/tests/*.spec.js`

**Step 1: Check formatting and repository state**

Run:

```bash
git diff --check main...HEAD
git status --short --branch
```

Expected: no whitespace errors and a clean feature branch.

**Step 2: Review the feature diff**

Run:

```bash
git diff --stat main...HEAD
git diff main...HEAD -- todo.html tests/tests/editing.spec.js tests/tests/checkboxes.spec.js
```

Expected: only the approved caret, celebration, accessibility, and test changes.

**Step 3: Integrate after verification**

Use `$finishing-a-development-branch` to merge the verified branch into local `main`. Rerun the full suite on merged `main`, update `/Users/cindyz/todo.html` to match the repository copy, verify byte equality, and push `main` to the configured GitHub remote.

