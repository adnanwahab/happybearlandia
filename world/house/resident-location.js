/** House presentation only: a date reservation is separate from the city home anchor. */
const rows = value => Array.isArray(value) ? value : [];
const personId = person => person?.id ?? person?.personId;
const currentDate = date => !!date && typeof date.id === 'string' && !!date.id &&
  (date.status == null || date.status === 'active') && date.endedMinute == null &&
  !['completed', 'ended', 'cancelled'].includes(date.phase);

/**
 * Use the inspected person's actual date, or this home's active date membership.
 * History, queued requests and matching venue coordinates do not create a date.
 * The owning household ID is retained so an explicit return can end the right date.
 */
export function activeResidentDate(person, data = {}) {
  const id = personId(person);
  if (id == null) return null;
  const home = data.home ?? data.house ?? data;
  const householdId = home.householdId ?? data.household?.id;
  const dates = home.systems?.dates;
  const active = currentDate(dates?.active) && rows(dates.active.personIds).includes(id)
    ? dates.active : null;
  const inspected = currentDate(person.date) &&
    (!Array.isArray(person.date.personIds) || person.date.personIds.includes(id))
    ? person.date : null;
  if (active) {
    const individual = inspected?.id === active.id ? inspected : null;
    return {
      ...active,
      ...individual,
      householdId: individual?.householdId ?? householdId,
      activity: individual?.activity ?? active.activity?.type ?? null,
      label: individual?.label ?? active.currentAction?.label ?? active.activity?.label ?? 'On a date',
      datePosition: individual?.datePosition ?? active.worldPositions?.[id] ?? null,
    };
  }
  // A current inspection of the owning home supersedes a stale per-person view.
  if (dates && householdId && inspected?.householdId === householdId) return null;
  return inspected;
}

export const isOnDate = (person, data = {}) => activeResidentDate(person, data) !== null;

/**
 * Offsite dates must not also appear in the house, even if a saved city's coarse
 * anchor still says HOME. Planning at home and genuine home dates remain visible.
 * Once a home date walks into its neighborhood, its date-local position owns it.
 * No actor, date, queue, coordinates or needs are changed by this projection.
 */
export function isResidentVisibleAtHome(person, data = {}) {
  if (!person || person.atHome === false) return false;
  const date = activeResidentDate(person, data);
  if (!date) return true;
  if (date.travel || ['traveling', 'traveling-home'].includes(date.phase)) return false;
  if (date.phase === 'planning') return true;
  if (date.venue?.kind !== 'home') return false;
  const home = data.home ?? data.house ?? data;
  const householdId = home.householdId ?? data.household?.id;
  if (householdId && date.householdId && date.householdId !== householdId) return false;
  if (rows(date.localMovement?.personIds).includes(personId(person))) return false;
  const position = date.datePosition;
  // Home dates start at (0, 0) and (0.8, 0); retained walks beyond that anchor
  // remain outside after cancellation instead of popping back into a bedroom.
  return !position || !Number.isFinite(position.x) || !Number.isFinite(position.z) ||
    Math.hypot(position.x, position.z) <= 1;
}
