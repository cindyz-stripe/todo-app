# Multiline Selection Delete

## Goal

Allow a text selection dragged across multiple visual lines in a todo to survive the transition from display mode to edit mode, so Backspace and forward Delete remove the selected text normally.

## Design

When an item-text click contains a non-collapsed selection wholly inside that item, capture the selection's start and end as plain-text character offsets before replacing the display element with the contenteditable editor. After opening the editor, resolve those offsets against its text nodes and restore the selection.

Ordinary clicks keep the existing behavior of placing the caret at the end. The editor does not implement custom deletion: the browser continues to handle Backspace and forward Delete, preserving native editing and undo behavior. Existing link-unwrapping behavior remains limited to collapsed carets.

## Testing

- Render a todo narrow enough to wrap across multiple visual lines.
- Select a range across those lines while it is still in display mode and trigger its click transition.
- Verify the same text remains selected inside the editor.
- Verify Backspace removes the selected text.
- Repeat the deletion assertion for forward Delete.
- Keep existing active-editor, link, keyboard navigation, data-safety, and undo tests passing.
