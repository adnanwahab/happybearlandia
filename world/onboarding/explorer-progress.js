/** Arrival URLs are produced by the place picker; progress is local UI state. */
export function createExplorerProgress(search) {
  const completed = new Set(new URLSearchParams(search).get('arrival') === '1' ? ['place'] : []);
  return {
    complete(action) {
      if (action === 'place' || action === 'policy') completed.add(action);
      return completed.has('place') && completed.has('policy');
    },
  };
}
