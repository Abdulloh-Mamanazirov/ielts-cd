/**
 * Feature switches for things that are built and working but deliberately not
 * shown yet. Flipping one back to `true` is the whole change — nothing was
 * deleted, so no work is lost while a feature is parked.
 */

/**
 * Sending a writing or speaking answer to the instructor for a band, and the
 * admin marking queue that receives it.
 *
 * Off for now: the instructor is not marking submissions yet. Students can
 * still sit both tests and everything they write or record is saved to their
 * dashboard exactly as before — the only thing hidden is the handover.
 */
export const INSTRUCTOR_MARKING_ENABLED = false;
