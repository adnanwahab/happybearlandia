export class Player {
  constructor({
    id,
    name,
    chips = 1000,
    isHuman = false,
    personality = null,
  }) {
    this.id = id;
    this.name = name;
    this.chips = chips;
    this.isHuman = isHuman;
    this.personality = personality ?? {
      aggression: 0.4,
      bluffFrequency: 0.12,
      riskTolerance: 0.45,
    };

    this.cards = [];
    this.currentBet = 0;
    this.contributedThisHand = 0;
    this.folded = false;
    this.allIn = false;
    this.lastAction = null;
  }

  resetForHand() {
    this.cards = [];
    this.currentBet = 0;
    this.contributedThisHand = 0;
    this.folded = false;
    this.allIn = false;
    this.lastAction = null;
  }
}
