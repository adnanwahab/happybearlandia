import { RANK_TO_VALUE } from "./Card.js";

const HAND_NAMES_BY_CATEGORY = {
  8: "Straight Flush",
  7: "Four of a Kind",
  6: "Full House",
  5: "Flush",
  4: "Straight",
  3: "Three of a Kind",
  2: "Two Pair",
  1: "Pair",
  0: "High Card",
};

function byValueDescending(a, b) {
  return b - a;
}

function combinations(items, choose) {
  const result = [];
  const n = items.length;

  function walk(start, picked) {
    if (picked.length === choose) {
      result.push(picked.slice());
      return;
    }

    for (let i = start; i < n; i++) {
      picked.push(items[i]);
      walk(i + 1, picked);
      picked.pop();
    }
  }

  walk(0, []);
  return result;
}

function detectStraight(values) {
  const unique = Array.from(new Set(values)).sort(byValueDescending);

  if (unique.includes(14)) {
    unique.push(1);
  }

  let run = 1;

  for (let i = 1; i < unique.length; i++) {
    if (unique[i - 1] - unique[i] === 1) {
      run += 1;

      if (run >= 5) {
        return unique[i - 4];
      }
    } else {
      run = 1;
    }
  }

  return null;
}

function lexicographicCompare(left, right) {
  const max = Math.max(left.length, right.length);

  for (let i = 0; i < max; i++) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;

    if (a !== b) {
      return a > b ? 1 : -1;
    }
  }

  return 0;
}

function evaluateFiveCards(cards) {
  const values = cards.map(card => RANK_TO_VALUE[card.rank]).sort(byValueDescending);
  const suits = cards.map(card => card.suit);

  const countsByValue = new Map();

  for (const value of values) {
    countsByValue.set(value, (countsByValue.get(value) ?? 0) + 1);
  }

  const grouped = Array.from(countsByValue.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }

      return b.value - a.value;
    });

  const isFlush = suits.every(suit => suit === suits[0]);
  const straightHigh = detectStraight(values);

  if (isFlush && straightHigh != null) {
    return {
      category: 8,
      tiebreak: [straightHigh],
    };
  }

  if (grouped[0]?.count === 4) {
    const quad = grouped[0].value;
    const kicker = grouped[1].value;

    return {
      category: 7,
      tiebreak: [quad, kicker],
    };
  }

  if (grouped[0]?.count === 3 && grouped[1]?.count === 2) {
    return {
      category: 6,
      tiebreak: [grouped[0].value, grouped[1].value],
    };
  }

  if (isFlush) {
    return {
      category: 5,
      tiebreak: values,
    };
  }

  if (straightHigh != null) {
    return {
      category: 4,
      tiebreak: [straightHigh],
    };
  }

  if (grouped[0]?.count === 3) {
    const trip = grouped[0].value;
    const kickers = grouped
      .slice(1)
      .map(group => group.value)
      .sort(byValueDescending);

    return {
      category: 3,
      tiebreak: [trip, ...kickers],
    };
  }

  if (grouped[0]?.count === 2 && grouped[1]?.count === 2) {
    const pairA = grouped[0].value;
    const pairB = grouped[1].value;
    const highPair = Math.max(pairA, pairB);
    const lowPair = Math.min(pairA, pairB);
    const kicker = grouped[2].value;

    return {
      category: 2,
      tiebreak: [highPair, lowPair, kicker],
    };
  }

  if (grouped[0]?.count === 2) {
    const pair = grouped[0].value;
    const kickers = grouped
      .slice(1)
      .map(group => group.value)
      .sort(byValueDescending);

    return {
      category: 1,
      tiebreak: [pair, ...kickers],
    };
  }

  return {
    category: 0,
    tiebreak: values,
  };
}

function compareEvaluations(left, right) {
  if (left.category !== right.category) {
    return left.category > right.category ? 1 : -1;
  }

  return lexicographicCompare(left.tiebreak, right.tiebreak);
}

export function evaluateHand(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards].filter(Boolean);

  if (allCards.length < 5) {
    return {
      rank: 1,
      category: 0,
      name: "High Card",
      tiebreak: [0],
      cards: allCards,
    };
  }

  const fiveCardSets = combinations(allCards, 5);

  let best = null;

  for (const cards of fiveCardSets) {
    const evaluation = evaluateFiveCards(cards);

    if (!best || compareEvaluations(evaluation, best) > 0) {
      best = {
        ...evaluation,
        cards,
      };
    }
  }

  return {
    rank: best.category + 1,
    category: best.category,
    name: HAND_NAMES_BY_CATEGORY[best.category],
    tiebreak: best.tiebreak,
    cards: best.cards,
  };
}

export function compareHandResults(left, right) {
  return compareEvaluations(left, right);
}
