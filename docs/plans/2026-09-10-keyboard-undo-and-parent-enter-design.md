# Keyboard Undo and Parent Enter Design

## Goal

Make `Cmd+Z` undo the most recent effective action and make Enter on a parent create a child immediately below it.

## Undo behavior

The app keeps its existing 50-entry snapshot history for structural and committed edits. It explicitly tracks whether the latest action belongs to the active contenteditable or the app, along with native redo depth. `Cmd+Z` and `Cmd+Shift+Z` therefore preserve character-level browser undo and redo while app actions—including structural changes that retain editor focus—use snapshot history. When outdenting after an unsaved edit, the text is recorded before the structural snapshot so undo restores the indentation without losing the preceding text change.

## Enter behavior

When Enter is pressed away from the beginning of a parent item, insert a blank child at the next array position with one additional indentation level. Existing children move down without changing. Leaf items continue to create a same-level sibling, and Enter at the beginning retains its current insert-above behavior.

## Persistence and testing

Every restored or inserted state continues through the existing Markdown write path. Playwright tests will cover parent deletion undo and redo while another editor retains focus, native text undo, and insertion of a focused child directly beneath a parent. After verification, the same HTML change will be applied to `/Users/cindyz/todo.html`, which is the file opened by Cindy's shortcut.
