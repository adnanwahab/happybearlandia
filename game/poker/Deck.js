import { Card } from "./Card.js";
import { shuffle } from "./utils/shuffle.js";

const SUITS = ["clubs", "diamonds", "hearts", "spades"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];

    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(rank, suit));
      }
    }

    shuffle(this.cards);
  }

  deal() {
    return this.cards.pop() ?? null;
  }
}
