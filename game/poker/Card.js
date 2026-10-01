const RANK_TO_VALUE = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const SUIT_TO_SYMBOL = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

export class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
  }

  get value() {
    return RANK_TO_VALUE[this.rank] ?? 0;
  }

  get code() {
    return `${this.rank}${this.suit[0].toUpperCase()}`;
  }

  toString() {
    return `${this.rank}${SUIT_TO_SYMBOL[this.suit] ?? "?"}`;
  }
}

export { RANK_TO_VALUE, SUIT_TO_SYMBOL };
