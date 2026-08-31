# Caret and Celebration Polish

## Goal

Make keyboard navigation between wrapped todos predictable and make checkbox completion more delightful without becoming distracting.

## Caret navigation

Arrow keys continue to move natively within a wrapped todo. When the caret is on the last visual line, ArrowDown opens the next todo and places the caret at its start. When the caret is on the first visual line, ArrowUp opens the previous todo and places the caret at its end. Clicking a todo retains the existing behavior of placing the caret at the end.

The editor-opening function will accept an optional caret placement. Its default remains `end`; only ArrowDown requests `start`. This keeps the change local and preserves existing click, Enter, and ArrowUp behavior.

## Completion celebration

Each completed todo still chooses one random emoji, and all three particles in that celebration use it. Consecutive celebrations still cannot repeat the previous emoji.

The three particles will fan left, center, and right using per-particle CSS custom properties for horizontal travel, vertical travel, rotation, scale, and delay. The checkbox wrapper will briefly show a soft pastel glow. Motion remains short and subtle.

For people who prefer reduced motion, particles will fade with minimal movement and the checkbox will avoid the springing pop.

## Testing

- Add a regression test with two adjacent wrapped todos that proves ArrowDown enters the second todo at its first visual line.
- Preserve the existing wrapped-line, ArrowUp, cross-section, rich-text, and selection coverage.
- Verify the celebration creates exactly three identical emoji particles with distinct fan directions.
- Verify consecutive celebrations use different emojis and unchecking does not create a new celebration.
- Verify the reduced-motion path disables the larger movement.

