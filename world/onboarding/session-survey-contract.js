export const SUGGESTION_LIMIT = 500;
export const RATINGS = ['', 'clear-and-fun', 'clear-not-fun', 'fun-not-clear', 'neither'];
export function validateSurvey(data) {
  if (!data || Array.isArray(data) || Object.keys(data).sort().join(',') !== 'consent,rating,suggestion,version' || data.version !== 1 || data.consent !== true || !RATINGS.includes(data.rating) || typeof data.suggestion !== 'string' || data.suggestion.length > SUGGESTION_LIMIT) throw Error('Consent and valid bounded answers required.');
  const suggestion = data.suggestion.trim();
  if (!data.rating && !suggestion) throw Error('Choose an answer or add a suggestion.');
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}|https?:\/\/|(?:\+?\d[\d ().-]{7,}\d)/i.test(suggestion)) throw Error('Remove contact details and links before sending.');
  return { version: 1, consent: true, rating: data.rating, suggestion };
}
// Session memory only. A replay must be explicitly started and then complete.
export function createSurveyEligibility() {
  let pending = false, count = 0, offered = false;
  return {
    replayStarted() { pending = true; },
    observe(state) {
      if (['stopped', 'error'].includes(state.status)) pending = false;
      if (state.status !== 'completed' || !pending) return false;
      pending = false;
      if (++count < 2 || offered) return false;
      offered = true;
      return true;
    },
  };
}
