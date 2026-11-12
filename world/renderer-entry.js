/** Compatibility entry for hosts migrating from the original World loader.
 * render.js already owns bounded GPU startup, Canvas fallback and model labels.
 * Keep one normal application entry so activity/policy actions share authority.
 */
export function startWorld() {
  return import('./render.js');
}
