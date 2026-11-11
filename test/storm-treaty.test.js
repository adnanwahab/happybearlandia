import { expect, test } from 'bun:test';
import { AID_TERMS, negotiateAid, TREATY_VERSION } from '../world/storm/treaty.js';

test('treaty is deterministic, charges posted price, and transfers conserved crews and funds', () => {
  for (const [crews, price] of [[1, 55000], [2, 95000]]) {
    const terms = { crews, offer: 120000 };
    const result = negotiateAid(terms);
    expect(result).toEqual(negotiateAid(terms));
    expect(result).toMatchObject({
      version: TREATY_VERSION, accepted: true, requestedCrews: crews, crews, price,
      minimumPrice: price, ledger: { transfer: { funds: price, crews } },
    });
    const { before, after } = result.ledger;
    expect(after.requester).toEqual({
      funds: AID_TERMS.responseBudget - price, crews: AID_TERMS.localCrews + crews,
    });
    expect(after.neighbor.crews).toBeGreaterThanOrEqual(AID_TERMS.neighborReserve);
    expect(after.requester.crews + after.neighbor.crews).toBe(before.requester.crews + before.neighbor.crews);
    expect(after.requester.funds + after.neighbor.funds).toBe(before.requester.funds + before.neighbor.funds);
  }
});

test('inactive and underfunded offers leave both treasuries and crew counts intact', () => {
  for (const terms of [{ crews: 0, offer: 150000 }, { crews: 1, offer: 54999 }, { crews: 2, offer: 94999 }]) {
    const result = negotiateAid(terms);
    expect(result).toMatchObject({ accepted: false, price: 0, crews: 0, ledger: { transfer: { funds: 0, crews: 0 } } });
    expect(result.ledger.before).toEqual(result.ledger.after);
  }
  expect(negotiateAid({ crews: 2, offer: 95000 }).accepted).toBe(true);
  for (const terms of [{ crews: 3, offer: 0 }, { crews: 1.5, offer: 60000 }, { crews: 0, offer: -1 }, { crews: 1, offer: 150001 }]) {
    expect(() => negotiateAid(terms)).toThrow('whole-dollar offer');
  }
});
