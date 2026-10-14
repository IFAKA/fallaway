// where the menu can send the player; shared by App and the lazy menu (types only, so no code crosses chunks)

/** how the on-screen game starts: the saved game, a fresh deal, or today's daily deal */
export type Start = 'resume' | 'new' | 'daily'
export type Destination = { mode: 'practice'; start: Start } | { mode: 'guide' }
/** `dive`: after the camera dive into the world, through its colour wash; `fade`: the menu fades out and the screen fades in (Real deck);
 *  `direct`: straight in (Continue, reduced motion) */
export type Arrival = 'dive' | 'fade' | 'direct'
