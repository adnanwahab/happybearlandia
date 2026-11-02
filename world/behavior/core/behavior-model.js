import { seededChoice } from './choice.js';
import { explainReasonCodes } from './reason-codes.js';

export function createBehaviorModel({ id, version, getAlternatives, filterEligible, score, coefficients = {} }) {
  if (!id || !version || typeof getAlternatives !== 'function' || typeof score !== 'function') throw new TypeError('A versioned model requires alternatives and scoring functions.');
  return Object.freeze({ id, version, coefficients,
    getAlternatives,
    filterEligible: filterEligible || ((_actor, alternatives) => alternatives),
    score,
    choose: (alternatives, options) => seededChoice(alternatives, options),
    explain: choice => ({ chosen: choice.chosen, randomDraw: choice.randomDraw, alternatives: choice.alternatives, reasons: explainReasonCodes(choice.reasonCodes || []) }),
    evaluate(actor, context, options) {
      const alternatives = getAlternatives(actor, context);
      const eligible = this.filterEligible(actor, alternatives, context);
      if (!Array.isArray(eligible)) throw new TypeError('Eligibility must return an array.');
      const allowed = new Set(eligible.filter(row => row.available !== false && row.eligible !== false).map(row => row.id));
      return this.choose(alternatives.map(row => allowed.has(row.id)
        ? { ...row, ...score(actor, row, context), available: true }
        : { ...row, available: false, rejectionReason: row.rejectionReason || 'HARD_CONSTRAINT' }), options);
    },
  });
}
