# Todo App

A single-file todo editor that syncs bidirectionally with a local Markdown file.

## Requirements

- **Chrome** (uses the [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access), which Safari/Firefox don't support)

## Setup

1. Download `todo.html`
2. Open it in Chrome (drag it onto Chrome, or `open -a "Google Chrome" todo.html`)
3. Click **Open File** and pick any `.md` file — or create a new empty one first
4. On macOS, press `Cmd+Shift+.` in the file picker to reveal hidden files if needed

That's it — no server, no install, no dependencies.

## Features

- Checkbox toggle with sparkle animations
- Drag-and-drop reorder (children move with parent)
- Inline editing: `Enter` creates sibling, `Tab`/`Shift+Tab` indent/outdent
- `Backspace` at start of line outdents before deleting
- Undo/redo (`Cmd+Z` / `Cmd+Shift+Z`), 50 levels deep
- Section collapse
- 1.2s polling — picks up external edits automatically

## Sync

The editor writes to your `.md` file on every change and polls for external changes. Works well alongside Obsidian or any other Markdown tool.

## Tests

```bash
cd tests
npm install
npx playwright test
```
