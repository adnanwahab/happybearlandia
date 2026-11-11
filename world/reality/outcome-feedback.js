/** Counts describe declared policy checks, never empirical success probabilities. */
export function formatOutcomeSummary(summary = {}) {
 const count = key => Number.isSafeInteger(summary[key]) && summary[key] >= 0 ? summary[key] : 0;
 const passed=count('passed'), completed=count('completed'), requested=count('requested');
 return `${passed}/${completed} completed pairs passed all declared policy tests · ${count('failed')} nonpassing · ${count('unavailable')} with unavailable tests · ${count('untested')} untested. ${completed}/${requested} requested pairs completed; ${count('errors')} execution errors. A nonpassing policy test is not a simulation error. These are synthetic scenario frequencies, not real-world probabilities.`;
}

export function realityControlReason(control, {busy=false, executable=false, result=false, selected=false, failed=false}={}) {
 if (control==='cancel') return busy?'':'No operation is running.';
 if (busy) return 'Wait for this operation to finish, or cancel it.';
 if (control==='run'&&!executable) return 'Compile a proposal with a supported executable mechanism first.';
 if (control==='export'&&!result) return 'Complete a paired experiment before exporting.';
 if (control==='time'&&!selected) return 'Enter a completed future to explore its modeled time.';
 if (['challenge','break'].includes(control)&&!result) return 'Complete a paired experiment first.';
 if (control==='fix'&&!failed) return 'Enter a future with a nonpassing policy test first.';
 return '';
}
