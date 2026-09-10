# Keyboard Undo and Parent Enter Design

## Goal

Make `Cmd+Z` undo the most recent effective action and make Enter on a parent create a child immediately below it.

## Undo behavior

The app keeps its existing 50-entry snapshot history for structural and committed edits. When an item editor contains text that differs from the model, `Cmd+Z` and `Cmd+Shift+Z` remain native browser operations so character-level text undo and redo continue to work. When the focused editor matches the model, the shortcut uses the app history; this covers structural changes that preserve focus on another item, including deleting a parent subtree.

## Enter behavior

When Enter is pressed away from the beginning of a parent item, insert a blank child at the next array position with one additional indentation level. Existing children move down without changing. Leaf items continue to create a same-level sibling, and Enter at the beginning retains its current insert-above behavior.

## Persistence and testing

Every restored or inserted state continues through the existing Markdown write path. Playwright tests will cover parent deletion undo and redo while another editor retains focus, native text undo, and insertion of a focused child directly beneath a parent. After verification, the same HTML change will be applied to `/Users/cindyz/todo.html`, which is the file opened by Cindy's shortcut.
