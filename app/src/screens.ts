// where the menu can send the player; shared by App and the lazy menu (no imports, so nothing heavy crosses chunks)

/** how the on-screen game starts: the saved game, a fresh deal, or today's daily deal */
export type Start = 'resume' | 'new' | 'daily'
export type Destination = { mode: 'practice'; start: Start } | { mode: 'guide' }
/** `dive`: after the camera dive into the world, through its colour wash; `fade`: the menu fades out and the screen fades in (Real deck);
 *  `direct`: no transition (reduced motion, or no menu before it: first load, reload, shared links) */
export type Arrival = 'dive' | 'fade' | 'direct'

/** the one rule for transitions: it depends only on where you go, never on which button took you there.
 *  A world on screen is entered by the camera dive and left by rising back out; Real deck (no world) fades in and out. */
export const transitionOf = (to: Destination): 'dive' | 'fade' => (to.mode === 'guide' ? 'fade' : 'dive')
