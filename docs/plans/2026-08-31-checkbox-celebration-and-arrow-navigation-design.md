# Checkbox Celebration and Arrow Navigation Design

## Goal

Make checkbox celebrations visually consistent within each burst while keeping successive bursts varied, and make Up/Down navigation behave naturally in visually wrapped todo items.

## Checkbox celebration

When an unchecked todo is checked, the app will randomly choose one emoji for that celebration and use it for all three particles. The next celebration will choose randomly from the remaining emojis, excluding the previous celebration's emoji so consecutive bursts are visibly different. Unchecking an item will not trigger a celebration.

## Arrow navigation

Chrome will retain its native Up/Down behavior while the caret can move between visual lines inside the current contenteditable item. The app will intercept Up only when the caret is on the first visual line, and Down only when it is on the last visual line. At those boundaries, it will preserve the current item's edited Markdown and move editing focus to the previous or next todo, including across section boundaries as it does today.

Visual-line position will be determined from the caret and content range rectangles rather than from newline characters, because todo text wraps visually without containing explicit newlines.

## Testing

Playwright coverage will verify that:

- All particles in one checkbox celebration use the same emoji.
- Consecutive checkbox celebrations use different emojis, even when the random source initially points at the prior emoji.
- Down moves the caret within a wrapped item when it is not on the final visual line.
- Down moves to the next todo from the final visual line.
- Up moves within a wrapped item when it is not on the first visual line.
- Up moves to the previous todo from the first visual line.

