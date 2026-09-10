# Keyboard Undo and Parent Enter Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `$executing-plans` to implement this plan task-by-task.

**Goal:** Make undo select the correct text or app history and make Enter on a parent insert a new first child.

**Architecture:** Keep the existing browser-native editing history and app-level JSON snapshot history. Choose between them by comparing the active editor DOM with its model item, and specialize the existing Enter insertion branch when the current item has descendants.

**Tech Stack:** Single-file HTML/JavaScript application, Playwright, Chrome File System Access API.

---

### Task 1: Route undo to the correct history

**Files:**
- Modify: `todo.html:2014-2021`
- Test: `tests/tests/editing.spec.js`

**Step 1: Write the failing structural undo and redo test**

Add a Playwright test that starts editing the first item, deletes the parent at index 2 while the first editor retains focus, presses `Meta+z`, and verifies the parent and its two children return. Then press `Meta+Shift+z` and verify that subtree is removed again.

**Step 2: Run the test to verify it fails**

Run: `cd tests && npx playwright test tests/editing.spec.js --grep "undoes a structural deletion"`

Expected: FAIL because the focused contenteditable consumes `Cmd+Z` instead of the app history.

**Step 3: Write the minimal implementation**

In the global undo handler, inspect the active `.item-edit`. Return to browser-native undo only when `getEditValue(activeEditor).trim()` differs from the current model item's text. Otherwise prevent the default and call `undo()` or `redo()`.

**Step 4: Run the test to verify it passes**

Run: `cd tests && npx playwright test tests/editing.spec.js --grep "undoes a structural deletion"`

Expected: PASS.

**Step 5: Add native text-undo coverage**

Add a Playwright test that types into an active item, presses `Meta+z`, and verifies Chrome restores the previous editor text without applying an older structural snapshot.

**Step 6: Run focused undo tests**

Run: `cd tests && npx playwright test tests/editing.spec.js --grep "undo"`

Expected: PASS.

### Task 2: Insert a child beneath a parent

**Files:**
- Modify: `todo.html:1552-1562`
- Test: `tests/tests/editing.spec.js`

**Step 1: Write the failing parent Enter test**

Press Enter at the end of fixture item `parent item`. Assert that index 3 is a focused blank editor at indentation 1 and that the two existing children follow it unchanged.

**Step 2: Run the test to verify it fails**

Run: `cd tests && npx playwright test tests/editing.spec.js --grep "enter on a parent"`

Expected: FAIL because the current handler inserts a same-level item after the entire subtree.

**Step 3: Write the minimal implementation**

Calculate the child count once. When it is positive, insert at `ii + 1` with `currentItem.indent + 1`; otherwise preserve the existing sibling insertion after the current item.

**Step 4: Run the test to verify it passes**

Run: `cd tests && npx playwright test tests/editing.spec.js --grep "enter on a parent"`

Expected: PASS.

### Task 3: Verify and deploy the local copy

**Files:**
- Modify: `/Users/cindyz/todo.html`

**Step 1: Run the full suite**

Run: `cd tests && npx playwright test`

Expected: all tests pass.

**Step 2: Apply the verified JavaScript changes to the local launch copy**

Apply the same undo-routing and Enter-insertion hunks to `/Users/cindyz/todo.html`.

**Step 3: Confirm both app files match**

Run: `shasum -a 256 todo.html /Users/cindyz/todo.html`

Expected: identical hashes.

**Step 4: Review the diff**

Run: `git diff --check && git diff -- todo.html tests/tests/editing.spec.js docs/plans`

Expected: no whitespace errors and only the planned changes.
