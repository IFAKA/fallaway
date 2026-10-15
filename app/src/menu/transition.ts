// Timings for moving between the menu and a world. They run on every game, so they stay short; both camera
// moves are ease-out (fast start, gentle finish), so a click answers at once (https://emilkowal.ski/ui/great-animations).

/** Camera dive into the selected world, from the menu until the board takes over. */
export const DIVE_SECONDS = 0.8
/** Rising back out of a world to the carousel, when you return to the menu. */
export const RISE_SECONDS = 0.8
/** The colour wash fades in from this point of the dive, while the camera is still moving. */
export const VEIL_START = 0.55
/** On the way back the wash clears quickly, so the pull-back is seen rather than hidden under it. */
export const RISE_VEIL_SECONDS = 0.2

/** Stopping a dig: how long the explorer's backpack flap takes to open, and to close again once the loot is in (explorer.tsx). */
export const FLAP = { open: 0.25, close: 0.2 }
