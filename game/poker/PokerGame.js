import * as THREE from "three";

import { Deck } from "./Deck.js";
import { Player } from "./Player.js";
import { PokerState } from "./PokerState.js";
import { evaluateHand, compareHandResults } from "./HandEvaluator.js";
import { createCardMesh } from "./graphics/createCardMesh.js";
import { createChipStack } from "./graphics/createChipStack.js";
import { createDealerButton } from "./graphics/createDealerButton.js";
import { createPokerTable } from "./graphics/createPokerTable.js";
import { animateCardDeal, animateObjectToPosition } from "./graphics/animateCardDeal.js";
import { getPlayerSeatPosition } from "./utils/getPlayerSeatPosition.js";
import { getCardPosition } from "./utils/getCardPosition.js";
import { getBetPosition } from "./utils/getBetPosition.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function money(value) {
  return `$${Math.max(0, Math.floor(value))}`;
}

export class PokerGame {
  constructor({
    scene,
    camera,
    renderer,
    tableCenter,
    tableY,
    onUiStateChange,
  }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.tableCenter = tableCenter?.clone?.() ?? new THREE.Vector3(0, 2, 12);
    this.tableY = Number.isFinite(tableY) ? tableY : 2.05;

    this.onUiStateChange = typeof onUiStateChange === "function" ? onUiStateChange : null;

    this.deck = new Deck();

    this.players = [
      new Player({ id: "player", name: "Happy Bear", chips: 1000, isHuman: true }),
      new Player({
        id: "bear-alice",
        name: "Alice",
        chips: 1000,
        personality: {
          aggression: 0.8,
          bluffFrequency: 0.3,
          riskTolerance: 0.75,
        },
      }),
      new Player({
        id: "bear-bob",
        name: "Bob",
        chips: 1000,
        personality: {
          aggression: 0.25,
          bluffFrequency: 0.08,
          riskTolerance: 0.32,
        },
      }),
      new Player({
        id: "bear-charlie",
        name: "Charlie",
        chips: 1000,
        personality: {
          aggression: 0.5,
          bluffFrequency: 0.14,
          riskTolerance: 0.54,
        },
      }),
    ];

    this.smallBlindAmount = 20;
    this.bigBlindAmount = 40;

    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastRaiseSize = this.bigBlindAmount;

    this.state = PokerState.WAITING;
    this.message = "Sit down to play Texas Hold'em.";

    this.dealerIndex = -1;
    this.smallBlindIndex = -1;
    this.bigBlindIndex = -1;
    this.turnIndex = 0;

    this.running = false;
    this.initialized = false;

    this.pendingHumanActionResolver = null;

    this.chipUnitValue = 25;
    this.delayBetweenHandsMs = 1700;

    this.playersActedThisRound = new Set();

    this.root = new THREE.Group();
    this.root.name = "PokerGameRoot";
    this.root.visible = false;

    this.cardsGroup = new THREE.Group();
    this.cardsGroup.name = "PokerCards";

    this.chipsGroup = new THREE.Group();
    this.chipsGroup.name = "PokerChips";

    this.decorGroup = new THREE.Group();
    this.decorGroup.name = "PokerDecor";

    this.holeCardMeshesByPlayerId = new Map();
    this.communityCardMeshes = [];
    this.betStacksByPlayerId = new Map();
    this.potVisualEntries = [];

    this.dealerButton = null;
    this.fallbackTable = null;
    this.seatBearsByPlayerId = new Map();
  }

  async init() {
    if (this.initialized) {
      return;
    }

    this.root.add(this.cardsGroup);
    this.root.add(this.chipsGroup);
    this.root.add(this.decorGroup);

    this.dealerButton = createDealerButton();
    this.decorGroup.add(this.dealerButton);

    this.createSeatBears();

    this.fallbackTable = createPokerTable();
    this.fallbackTable.position.copy(this.tableCenter);
    this.fallbackTable.visible = false;
    this.decorGroup.add(this.fallbackTable);

    this.updateDealerButtonPosition();

    this.scene.add(this.root);

    this.initialized = true;
    this.emitUiState();
  }

  update() {
    // Reserved for future per-frame poker animations.
  }

  start() {
    if (!this.initialized) {
      throw new Error("PokerGame.init() must run before start().");
    }

    if (this.running) {
      return;
    }

    this.running = true;
    this.root.visible = true;
    this.runLoop();
    this.emitUiState();
  }

  stop() {
    if (!this.running && !this.root.visible) {
      return;
    }

    this.running = false;

    if (this.pendingHumanActionResolver) {
      this.pendingHumanActionResolver({ action: "fold", forced: true });
      this.pendingHumanActionResolver = null;
    }

    this.state = PokerState.WAITING;
    this.message = "Walk up and press E to play poker.";

    this.clearTableVisuals();
    this.root.visible = false;

    this.emitUiState();
  }

  fold() {
    this.submitHumanAction({ action: "fold" });
  }

  check() {
    this.submitHumanAction({ action: "check" });
  }

  call() {
    this.submitHumanAction({ action: "call" });
  }

  raise(amount) {
    this.submitHumanAction({ action: "raise", amount: parseNumber(amount, 0) });
  }

  submitHumanAction(actionPayload) {
    if (!this.pendingHumanActionResolver) {
      return;
    }

    this.pendingHumanActionResolver(actionPayload ?? { action: "check" });
    this.pendingHumanActionResolver = null;
  }

  async runLoop() {
    while (this.running) {
      await this.playHand();

      if (!this.running) {
        break;
      }

      await this.delay(this.delayBetweenHandsMs);
    }
  }

  async playHand() {
    this.state = PokerState.START_HAND;

    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.lastRaiseSize = this.bigBlindAmount;

    this.clearTableVisuals();
    this.deck.reset();

    for (const player of this.players) {
      if (player.chips <= 0) {
        player.chips = 1000;
      }

      player.resetForHand();
    }

    this.rotateDealerButton();
    this.assignBlinds();
    this.postBlinds();

    this.state = PokerState.DEAL_HOLE_CARDS;
    this.emitUiState();

    this.setMessage(
      `New hand • Dealer: ${this.players[this.dealerIndex].name} • SB: ${money(this.smallBlindAmount)} • BB: ${money(this.bigBlindAmount)}`,
    );

    await this.dealHoleCards();

    if (!this.running) {
      return;
    }

    const preflopFirst = this.getNextLivePlayerIndex(this.bigBlindIndex);
    const preflopCompleted = await this.playBettingRound(PokerState.PREFLOP_BETTING, {
      firstToActIndex: preflopFirst,
      resetStreetBets: false,
    });

    if (!this.running || !preflopCompleted) {
      return;
    }

    await this.dealFlop();

    if (!this.running) {
      return;
    }

    const flopCompleted = await this.playBettingRound(PokerState.FLOP_BETTING, {
      firstToActIndex: this.getNextLivePlayerIndex(this.dealerIndex),
      resetStreetBets: true,
    });

    if (!this.running || !flopCompleted) {
      return;
    }

    await this.dealTurn();

    if (!this.running) {
      return;
    }

    const turnCompleted = await this.playBettingRound(PokerState.TURN_BETTING, {
      firstToActIndex: this.getNextLivePlayerIndex(this.dealerIndex),
      resetStreetBets: true,
    });

    if (!this.running || !turnCompleted) {
      return;
    }

    await this.dealRiver();

    if (!this.running) {
      return;
    }

    const riverCompleted = await this.playBettingRound(PokerState.RIVER_BETTING, {
      firstToActIndex: this.getNextLivePlayerIndex(this.dealerIndex),
      resetStreetBets: true,
    });

    if (!this.running || !riverCompleted) {
      return;
    }

    await this.resolveShowdown();

    this.state = PokerState.COMPLETE;
    this.emitUiState();
  }

  rotateDealerButton() {
    this.dealerIndex = this.getNextPlayerIndexWithChips(this.dealerIndex);
    this.updateDealerButtonPosition();
  }

  assignBlinds() {
    this.smallBlindIndex = this.getNextLivePlayerIndex(this.dealerIndex);
    this.bigBlindIndex = this.getNextLivePlayerIndex(this.smallBlindIndex);
  }

  postBlinds() {
    this.currentBet = 0;

    const sbPlayer = this.players[this.smallBlindIndex];
    const bbPlayer = this.players[this.bigBlindIndex];

    const sbPosted = this.commitChips(sbPlayer, this.smallBlindAmount);
    sbPlayer.lastAction = sbPlayer.allIn ? `all-in blind ${money(sbPosted)}` : `small blind ${money(sbPosted)}`;

    const bbPosted = this.commitChips(bbPlayer, this.bigBlindAmount);
    bbPlayer.lastAction = bbPlayer.allIn ? `all-in blind ${money(bbPosted)}` : `big blind ${money(bbPosted)}`;

    this.currentBet = Math.max(sbPlayer.currentBet, bbPlayer.currentBet);
    this.lastRaiseSize = Math.max(this.bigBlindAmount, this.currentBet);

    this.refreshBetVisuals();
    this.refreshPotVisual();
    this.emitUiState();
  }

  async playBettingRound(roundState, { firstToActIndex, resetStreetBets }) {
    this.state = roundState;

    if (resetStreetBets) {
      this.currentBet = 0;
      this.lastRaiseSize = this.bigBlindAmount;

      for (const player of this.players) {
        player.currentBet = 0;
      }
    }

    this.turnIndex = firstToActIndex;
    this.playersActedThisRound = new Set();

    this.refreshBetVisuals();
    this.refreshPotVisual();

    this.setMessage(this.getRoundLabel(roundState));

    if (this.getActionablePlayers().length <= 1) {
      return true;
    }

    while (this.running) {
      const activePlayers = this.getPlayersStillInHand();

      if (activePlayers.length <= 1) {
        await this.resolveByFolds();
        return false;
      }

      const player = this.players[this.turnIndex];

      if (this.canPlayerAct(player)) {
        await this.takeTurn(player);
      }

      if (!this.running) {
        return false;
      }

      if (this.getPlayersStillInHand().length <= 1) {
        await this.resolveByFolds();
        return false;
      }

      if (this.isBettingRoundComplete()) {
        return true;
      }

      this.turnIndex = this.getNextLivePlayerIndex(this.turnIndex);
    }

    return false;
  }

  async takeTurn(player) {
    const toCall = Math.max(0, this.currentBet - player.currentBet);

    this.setMessage(`${player.name}'s turn${toCall > 0 ? ` • Call ${money(toCall)}` : ""}`);

    let action = null;

    if (player.isHuman) {
      action = await this.awaitHumanAction();
    } else {
      await this.delay(500 + Math.random() * 280);
      action = this.decideNpcAction(player);
    }

    if (!this.running) {
      return;
    }

    this.applyAction(player, action);

    this.refreshBetVisuals();
    this.refreshPotVisual();
    this.emitUiState();
  }

  awaitHumanAction() {
    return new Promise(resolve => {
      this.pendingHumanActionResolver = resolve;
      this.emitUiState();
    });
  }

  applyAction(player, action) {
    const normalizedAction = typeof action?.action === "string" ? action.action : "check";
    const toCall = Math.max(0, this.currentBet - player.currentBet);

    if (normalizedAction === "fold") {
      if (toCall <= 0) {
        this.applyAction(player, { action: "check" });
        return;
      }

      player.folded = true;
      player.lastAction = "fold";
      this.playersActedThisRound.add(player.id);
      this.setMessage(`${player.name} folds.`);
      return;
    }

    if (normalizedAction === "raise") {
      const maxTarget = player.currentBet + player.chips;

      if (maxTarget <= this.currentBet) {
        this.applyAction(player, { action: toCall > 0 ? "call" : "check" });
        return;
      }

      const minFullRaiseTarget = this.currentBet + this.lastRaiseSize;
      const fallbackTarget = Math.max(minFullRaiseTarget, this.currentBet + 1);
      const requestedTarget = parseNumber(action?.amount, fallbackTarget);

      const target = clamp(requestedTarget, this.currentBet + 1, maxTarget);

      if (target <= this.currentBet) {
        this.applyAction(player, { action: toCall > 0 ? "call" : "check" });
        return;
      }

      const previousCurrentBet = this.currentBet;
      const raiseBy = target - previousCurrentBet;
      const contribution = target - player.currentBet;

      this.commitChips(player, contribution);

      this.currentBet = player.currentBet;

      const isFullRaise = raiseBy >= this.lastRaiseSize;

      if (isFullRaise) {
        this.lastRaiseSize = raiseBy;
        this.playersActedThisRound = new Set([player.id]);

        player.lastAction = player.allIn
          ? `all-in raise to ${money(player.currentBet)}`
          : `raise to ${money(player.currentBet)}`;

        this.setMessage(`${player.name} raises to ${money(player.currentBet)}.`);
      } else {
        this.playersActedThisRound.add(player.id);

        player.lastAction = `all-in to ${money(player.currentBet)}`;
        this.setMessage(`${player.name} is all-in for ${money(player.currentBet)}.`);
      }

      return;
    }

    if (normalizedAction === "call" || (normalizedAction === "check" && toCall > 0)) {
      const contribution = Math.min(toCall, player.chips);

      this.commitChips(player, contribution);
      this.playersActedThisRound.add(player.id);

      if (contribution < toCall) {
        player.lastAction = `all-in ${money(player.currentBet)}`;
        this.setMessage(`${player.name} is all-in for ${money(player.currentBet)}.`);
      } else {
        player.lastAction = contribution > 0 ? `call ${money(contribution)}` : "check";
        this.setMessage(contribution > 0 ? `${player.name} calls ${money(contribution)}.` : `${player.name} checks.`);
      }

      return;
    }

    player.lastAction = "check";
    this.playersActedThisRound.add(player.id);
    this.setMessage(`${player.name} checks.`);
  }

  commitChips(player, desiredAmount) {
    const amount = Math.max(0, Math.floor(desiredAmount));

    if (amount <= 0 || player.chips <= 0) {
      if (player.chips <= 0) {
        player.allIn = true;
      }

      return 0;
    }

    const contribution = Math.min(amount, player.chips);

    player.chips -= contribution;
    player.currentBet += contribution;
    player.contributedThisHand += contribution;
    player.allIn = player.chips <= 0;

    this.pot += contribution;

    return contribution;
  }

  isBettingRoundComplete() {
    const playersStillActing = this.getActionablePlayers();

    if (playersStillActing.length <= 1) {
      return true;
    }

    for (const player of playersStillActing) {
      if (player.currentBet !== this.currentBet) {
        return false;
      }

      if (!this.playersActedThisRound.has(player.id)) {
        return false;
      }
    }

    return true;
  }

  decideNpcAction(player) {
    const toCall = Math.max(0, this.currentBet - player.currentBet);

    const personality = player.personality ?? {
      aggression: 0.4,
      bluffFrequency: 0.1,
      riskTolerance: 0.4,
    };

    const hand = evaluateHand(player.cards, this.communityCards);

    const strength = clamp((hand.rank - 1) / 8, 0, 1);
    const confidence = clamp(
      strength * 0.62 + personality.riskTolerance * 0.18 + personality.bluffFrequency * 0.1 + Math.random() * 0.22,
      0,
      1,
    );

    const stackPressure = toCall > 0 ? toCall / Math.max(1, player.chips + toCall) : 0;

    const foldThreshold = clamp(0.45 - confidence * 0.4 + stackPressure * 0.5, 0.03, 0.86);
    const raiseThreshold = clamp(0.68 - personality.aggression * 0.35 - confidence * 0.18, 0.22, 0.92);

    const roll = Math.random();

    if (toCall > 0 && roll < foldThreshold && player.chips > 0) {
      return { action: "fold" };
    }

    const maxTarget = player.currentBet + player.chips;
    const wantsRaise = maxTarget > this.currentBet && roll > raiseThreshold;

    if (wantsRaise) {
      const minTarget = this.currentBet + Math.max(1, this.lastRaiseSize);
      const extra = Math.floor((player.chips * (0.08 + personality.aggression * 0.2)) / this.bigBlindAmount) * this.bigBlindAmount;
      const aspirational = this.currentBet + this.lastRaiseSize + extra;

      return {
        action: "raise",
        amount: clamp(aspirational, this.currentBet + 1, Math.max(this.currentBet + 1, maxTarget, minTarget)),
      };
    }

    return { action: toCall > 0 ? "call" : "check" };
  }

  async dealHoleCards() {
    const dealerPosition = this.getDealerDealPosition();

    for (let round = 0; round < 2; round++) {
      for (let seat = 0; seat < this.players.length; seat++) {
        const player = this.players[seat];

        const card = this.deck.deal();

        if (!card) {
          continue;
        }

        player.cards.push(card);

        const cardMesh = createCardMesh(card, { faceUp: player.isHuman });

        cardMesh.position.copy(dealerPosition);

        const target = getCardPosition({
          seat,
          playerCount: this.players.length,
          cardIndex: round,
          center: this.tableCenter,
          tableY: this.tableY + 0.03,
        });

        cardMesh.rotation.y = this.getSeatCardYaw(seat);

        this.cardsGroup.add(cardMesh);

        if (!this.holeCardMeshesByPlayerId.has(player.id)) {
          this.holeCardMeshesByPlayerId.set(player.id, []);
        }

        this.holeCardMeshesByPlayerId.get(player.id).push(cardMesh);

        await animateCardDeal(cardMesh, target, 280);

        if (!this.running) {
          return;
        }
      }
    }

    this.emitUiState();
  }

  async dealFlop() {
    this.state = PokerState.FLOP;

    this.deck.deal();

    const dealerPosition = this.getDealerDealPosition();

    for (let i = 0; i < 3; i++) {
      const card = this.deck.deal();

      if (!card) {
        continue;
      }

      this.communityCards.push(card);

      const mesh = createCardMesh(card, { faceUp: true });
      mesh.position.copy(dealerPosition);
      mesh.rotation.y = 0;

      this.cardsGroup.add(mesh);
      this.communityCardMeshes.push(mesh);

      const target = this.getCommunityCardPosition(i);
      await animateCardDeal(mesh, target, 320);

      if (!this.running) {
        return;
      }
    }

    this.emitUiState();
  }

  async dealTurn() {
    this.state = PokerState.TURN;

    this.deck.deal();

    const card = this.deck.deal();

    if (!card) {
      return;
    }

    this.communityCards.push(card);

    const mesh = createCardMesh(card, { faceUp: true });
    mesh.position.copy(this.getDealerDealPosition());

    this.cardsGroup.add(mesh);
    this.communityCardMeshes.push(mesh);

    await animateCardDeal(mesh, this.getCommunityCardPosition(3), 300);

    this.emitUiState();
  }

  async dealRiver() {
    this.state = PokerState.RIVER;

    this.deck.deal();

    const card = this.deck.deal();

    if (!card) {
      return;
    }

    this.communityCards.push(card);

    const mesh = createCardMesh(card, { faceUp: true });
    mesh.position.copy(this.getDealerDealPosition());

    this.cardsGroup.add(mesh);
    this.communityCardMeshes.push(mesh);

    await animateCardDeal(mesh, this.getCommunityCardPosition(4), 300);

    this.emitUiState();
  }

  async resolveByFolds() {
    this.state = PokerState.PAYOUT;

    const winner = this.getPlayersStillInHand()[0] ?? this.players[0];
    const payout = this.pot;

    await this.animateRevealNpcCards();

    await this.animatePotToWinner(winner);

    winner.chips += payout;
    this.pot = 0;

    this.refreshPotVisual();

    this.setMessage(`${winner.name} wins ${money(payout)} after everyone else folded.`);
    this.emitUiState();
  }

  buildSidePots() {
    const contributors = this.players.filter(player => player.contributedThisHand > 0);

    const levels = Array.from(new Set(contributors.map(player => player.contributedThisHand))).sort((a, b) => a - b);

    const sidePots = [];
    let previousLevel = 0;

    for (const level of levels) {
      const payingPlayers = contributors.filter(player => player.contributedThisHand >= level);
      const layerAmount = (level - previousLevel) * payingPlayers.length;

      if (layerAmount <= 0) {
        previousLevel = level;
        continue;
      }

      const eligiblePlayers = payingPlayers.filter(player => !player.folded);

      if (eligiblePlayers.length > 0) {
        sidePots.push({
          amount: layerAmount,
          eligiblePlayers,
        });
      }

      previousLevel = level;
    }

    return sidePots;
  }

  async resolveShowdown() {
    this.state = PokerState.SHOWDOWN;

    await this.animateRevealNpcCards();

    const contenders = this.getPlayersStillInHand();

    const evaluationByPlayerId = new Map(
      contenders.map(player => [
        player.id,
        evaluateHand(player.cards, this.communityCards),
      ]),
    );

    const sidePots = this.buildSidePots();

    if (sidePots.length === 0) {
      this.setMessage("No contested pot this hand.");
      return;
    }

    const winningsByPlayerId = new Map();
    const potResults = [];

    for (let potIndex = 0; potIndex < sidePots.length; potIndex++) {
      const sidePot = sidePots[potIndex];

      const eligibleEntries = sidePot.eligiblePlayers
        .map(player => ({
          player,
          result: evaluationByPlayerId.get(player.id),
        }))
        .filter(entry => entry.result);

      if (eligibleEntries.length === 0) {
        continue;
      }

      eligibleEntries.sort((left, right) => compareHandResults(right.result, left.result));

      const best = eligibleEntries[0].result;
      const winners = eligibleEntries.filter(entry => compareHandResults(entry.result, best) === 0);

      const orderedWinners = winners
        .slice()
        .sort((left, right) => this.getSeatOrderDistance(left.player.id) - this.getSeatOrderDistance(right.player.id));

      const split = Math.floor(sidePot.amount / orderedWinners.length);
      let remainder = sidePot.amount - split * orderedWinners.length;

      for (const winnerEntry of orderedWinners) {
        let payout = split;

        if (remainder > 0) {
          payout += 1;
          remainder -= 1;
        }

        const playerId = winnerEntry.player.id;

        winningsByPlayerId.set(playerId, (winningsByPlayerId.get(playerId) ?? 0) + payout);
      }

      potResults.push({
        potIndex,
        label: potIndex === 0 ? "Main pot" : `Side pot ${potIndex}`,
        winners: orderedWinners.map(entry => entry.player),
        handName: best.name,
        amount: sidePot.amount,
      });
    }

    this.state = PokerState.PAYOUT;

    await this.animatePotResultsToWinners(potResults);

    for (const [playerId, payout] of winningsByPlayerId.entries()) {
      const player = this.players.find(candidate => candidate.id === playerId);

      if (!player) {
        continue;
      }

      player.chips += payout;
    }

    this.pot = 0;
    this.refreshPotVisual();

    const summary = potResults
      .slice(0, 2)
      .map(result => `${result.label}: ${result.winners.map(player => player.name).join(" & ")} (${result.handName}, ${money(result.amount)})`)
      .join(" • ");

    this.setMessage(summary || "Showdown complete.");
    this.emitUiState();
  }

  getSeatOrderDistance(playerId) {
    const seatIndex = this.getSeatIndexByPlayerId(playerId);
    const start = this.getNextLivePlayerIndex(this.dealerIndex);

    if (seatIndex < 0 || start < 0) {
      return Number.POSITIVE_INFINITY;
    }

    return (seatIndex - start + this.players.length) % this.players.length;
  }

  async animateRevealNpcCards() {
    for (const player of this.players) {
      if (player.isHuman || player.folded) {
        continue;
      }

      const cardMeshes = this.holeCardMeshesByPlayerId.get(player.id) ?? [];

      for (const mesh of cardMeshes) {
        if (typeof mesh?.userData?.setFaceUp === "function") {
          mesh.userData.setFaceUp(true);
        }
      }
    }

    this.emitUiState();

    await this.delay(600);
  }

  async animatePotToWinner(winner) {
    const entries = this.potVisualEntries
      .slice()
      .sort((left, right) => left.potIndex - right.potIndex);

    for (const entry of entries) {
      await this.animatePotEntryToWinner(entry, winner);
    }
  }

  async animatePotResultsToWinners(potResults) {
    const ordered = potResults
      .slice()
      .sort((left, right) => left.potIndex - right.potIndex);

    for (const result of ordered) {
      const primaryWinner = result.winners?.[0] ?? null;

      if (!primaryWinner) {
        continue;
      }

      const entry = this.potVisualEntries.find(candidate => candidate.potIndex === result.potIndex) ?? null;

      if (!entry) {
        continue;
      }

      await this.animatePotEntryToWinner(entry, primaryWinner);
    }

    this.clearPotVisualEntries();
  }

  async animatePotEntryToWinner(entry, winner) {
    if (!entry?.stack || !winner) {
      return;
    }

    const winnerSeat = this.players.findIndex(player => player.id === winner.id);

    if (winnerSeat < 0) {
      this.chipsGroup.remove(entry.stack);
      if (entry.label) {
        this.chipsGroup.remove(entry.label);
      }

      this.potVisualEntries = this.potVisualEntries.filter(candidate => candidate !== entry);
      return;
    }

    const target = getBetPosition({
      seat: winnerSeat,
      playerCount: this.players.length,
      center: this.tableCenter,
      tableY: this.tableY + 0.02,
      inwardDistance: 1.2,
    });

    if (entry.label) {
      this.chipsGroup.remove(entry.label);
    }

    const lateralOffset = (entry.potIndex % 2 === 0 ? -1 : 1) * Math.floor(entry.potIndex * 0.5) * 0.12;
    const animatedTarget = target.clone().add(new THREE.Vector3(lateralOffset, 0, 0));

    await animateObjectToPosition(entry.stack, animatedTarget, 560);

    this.chipsGroup.remove(entry.stack);
    this.potVisualEntries = this.potVisualEntries.filter(candidate => candidate !== entry);
  }

  clearPotVisualEntries() {
    for (const entry of this.potVisualEntries) {
      if (entry?.stack) {
        this.chipsGroup.remove(entry.stack);
      }

      if (entry?.label) {
        this.chipsGroup.remove(entry.label);
      }
    }

    this.potVisualEntries = [];
  }

  createPotLabelSprite(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(147, 197, 253, 0.9)";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 52px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.5);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      }),
    );

    sprite.scale.set(1.35, 0.32, 1);

    return sprite;
  }

  refreshBetVisuals() {
    for (const stack of this.betStacksByPlayerId.values()) {
      this.chipsGroup.remove(stack);
    }

    this.betStacksByPlayerId.clear();

    for (let seat = 0; seat < this.players.length; seat++) {
      const player = this.players[seat];

      if (player.currentBet <= 0 || player.folded) {
        continue;
      }

      const chipCount = Math.max(1, Math.ceil(player.currentBet / this.chipUnitValue));

      const stackPosition = getBetPosition({
        seat,
        playerCount: this.players.length,
        center: this.tableCenter,
        tableY: this.tableY + 0.02,
      });

      const color = player.isHuman ? 0x10b981 : 0xf59e0b;

      const stack = createChipStack(chipCount, stackPosition, {
        chipColor: color,
      });

      this.betStacksByPlayerId.set(player.id, stack);
      this.chipsGroup.add(stack);
    }
  }

  refreshPotVisual() {
    this.clearPotVisualEntries();

    if (this.pot <= 0) {
      return;
    }

    const sidePots = this.buildSidePots();

    const potsForVisual = sidePots.length > 0
      ? sidePots
      : [
          {
            amount: this.pot,
            eligiblePlayers: this.getPlayersStillInHand(),
          },
        ];

    const spacing = 0.7;
    const startOffsetX = -((potsForVisual.length - 1) * spacing) * 0.5;

    const chipColors = [0x2563eb, 0x7c3aed, 0x0f766e, 0xb45309, 0xbe123c];

    for (let potIndex = 0; potIndex < potsForVisual.length; potIndex++) {
      const pot = potsForVisual[potIndex];

      const chipCount = Math.max(1, Math.ceil(pot.amount / this.chipUnitValue));

      const position = this.tableCenter
        .clone()
        .setY(this.tableY + 0.02)
        .add(
          new THREE.Vector3(
            startOffsetX + potIndex * spacing,
            0,
            potsForVisual.length > 1 ? 0.36 : 0,
          ),
        );

      const stack = createChipStack(chipCount, position, {
        chipColor: chipColors[potIndex % chipColors.length],
        maxVisible: 30,
      });

      this.chipsGroup.add(stack);

      const labelText = `${potIndex === 0 ? "Main" : `Side ${potIndex}`} ${money(pot.amount)}`;
      const label = this.createPotLabelSprite(labelText);

      const labelHeight = 0.32 + Math.min(0.6, chipCount * 0.05);
      label.position.copy(position).add(new THREE.Vector3(0, labelHeight, 0));

      this.chipsGroup.add(label);

      this.potVisualEntries.push({
        potIndex,
        amount: pot.amount,
        stack,
        label,
      });
    }
  }

  getNextPlayerIndexWithChips(startIndex) {
    let nextIndex = Number.isFinite(startIndex) ? startIndex : -1;

    for (let i = 0; i < this.players.length; i++) {
      nextIndex = (nextIndex + 1) % this.players.length;
      const player = this.players[nextIndex];

      if (player.chips > 0) {
        return nextIndex;
      }
    }

    return 0;
  }

  getNextLivePlayerIndex(startIndex) {
    let nextIndex = Number.isFinite(startIndex) ? startIndex : -1;

    for (let i = 0; i < this.players.length; i++) {
      nextIndex = (nextIndex + 1) % this.players.length;
      const player = this.players[nextIndex];

      if (!player.folded) {
        return nextIndex;
      }
    }

    return 0;
  }

  getSeatIndexByPlayerId(playerId) {
    return this.players.findIndex(player => player.id === playerId);
  }

  canPlayerAct(player) {
    return !player.folded && !player.allIn;
  }

  getPlayersStillInHand() {
    return this.players.filter(player => !player.folded);
  }

  getActionablePlayers() {
    return this.players.filter(player => this.canPlayerAct(player));
  }

  getDealerDealPosition() {
    return this.tableCenter.clone().setY(this.tableY + 0.18).add(new THREE.Vector3(0, 0, 0.25));
  }

  getCommunityCardPosition(index) {
    const startX = -1.68;
    const spacing = 0.84;

    return new THREE.Vector3(
      this.tableCenter.x + startX + spacing * index,
      this.tableY + 0.03,
      this.tableCenter.z,
    );
  }

  getSeatCardYaw(seat) {
    const seatPosition = getPlayerSeatPosition(seat, this.players.length, {
      center: this.tableCenter,
      radiusX: 2.45,
      radiusZ: 1.55,
      y: this.tableY,
    });

    const toCenter = new THREE.Vector3(
      this.tableCenter.x - seatPosition.x,
      0,
      this.tableCenter.z - seatPosition.z,
    ).normalize();

    return Math.atan2(toCenter.x, toCenter.z) + Math.PI * 0.5;
  }

  clearTableVisuals() {
    for (const cardMeshes of this.holeCardMeshesByPlayerId.values()) {
      for (const mesh of cardMeshes) {
        this.cardsGroup.remove(mesh);
      }
    }

    this.holeCardMeshesByPlayerId.clear();

    for (const mesh of this.communityCardMeshes) {
      this.cardsGroup.remove(mesh);
    }

    this.communityCardMeshes = [];

    for (const stack of this.betStacksByPlayerId.values()) {
      this.chipsGroup.remove(stack);
    }

    this.betStacksByPlayerId.clear();

    this.clearPotVisualEntries();
  }

  createSeatBears() {
    for (const bear of this.seatBearsByPlayerId.values()) {
      this.decorGroup.remove(bear);
    }

    this.seatBearsByPlayerId.clear();

    for (let seat = 0; seat < this.players.length; seat++) {
      const player = this.players[seat];

      const seatPos = getPlayerSeatPosition(seat, this.players.length, {
        center: this.tableCenter,
        radiusX: 3.35,
        radiusZ: 2.2,
        y: this.tableY - 1.25,
      });

      const label = player.isHuman ? "You" : player.name;
      const bear = this.createBearMascot(label);
      bear.position.copy(seatPos);

      const lookTarget = this.tableCenter.clone();
      bear.lookAt(lookTarget.x, seatPos.y, lookTarget.z);

      this.decorGroup.add(bear);
      this.seatBearsByPlayerId.set(player.id, bear);
    }
  }

  setHumanSeatBearVisible(visible) {
    const humanBear = this.seatBearsByPlayerId.get("player") ?? null;

    if (!humanBear) {
      return;
    }

    humanBear.visible = visible === true;
  }

  createBearMascot(name) {
    const bear = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 18, 18),
      new THREE.MeshStandardMaterial({
        color: 0x8b5a2b,
        roughness: 0.8,
        metalness: 0.02,
      }),
    );

    body.position.y = 0.45;
    bear.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 18, 18),
      new THREE.MeshStandardMaterial({
        color: 0x9c6a34,
        roughness: 0.75,
        metalness: 0.02,
      }),
    );

    head.position.y = 0.9;
    bear.add(head);

    const earOffset = 0.18;

    for (const x of [-earOffset, earOffset]) {
      const ear = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0x9c6a34,
          roughness: 0.75,
          metalness: 0.02,
        }),
      );

      ear.position.set(x, 1.13, -0.03);
      bear.add(ear);
    }

    const label = this.createNameTag(name);
    label.position.set(0, 1.35, 0);
    bear.add(label);

    bear.userData.type = "poker-bear";

    return bear;
  }

  createNameTag(name) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 96;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.9)";
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, canvas.width * 0.5, canvas.height * 0.5);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      }),
    );

    sprite.scale.set(0.95, 0.36, 1);

    return sprite;
  }

  updateDealerButtonPosition() {
    if (!this.dealerButton) {
      return;
    }

    const seatPos = getPlayerSeatPosition(this.dealerIndex < 0 ? 0 : this.dealerIndex, this.players.length, {
      center: this.tableCenter,
      radiusX: 2.45,
      radiusZ: 1.55,
      y: this.tableY + 0.05,
    });

    const toCenter = new THREE.Vector3(this.tableCenter.x - seatPos.x, 0, this.tableCenter.z - seatPos.z).normalize();

    this.dealerButton.position.copy(seatPos.clone().add(toCenter.multiplyScalar(0.6)));
  }

  delay(ms) {
    return new Promise(resolve => {
      window.setTimeout(resolve, ms);
    });
  }

  getRoundLabel(roundState) {
    switch (roundState) {
      case PokerState.PREFLOP_BETTING:
        return "Preflop betting";
      case PokerState.FLOP_BETTING:
        return "Flop betting";
      case PokerState.TURN_BETTING:
        return "Turn betting";
      case PokerState.RIVER_BETTING:
        return "River betting";
      default:
        return "Betting";
    }
  }

  setMessage(message) {
    this.message = message;
    this.emitUiState();
  }

  emitUiState() {
    if (!this.onUiStateChange) {
      return;
    }

    this.onUiStateChange(this.getUiState());
  }

  getUiState() {
    const human = this.players[0];
    const isHumanTurn = this.running && this.players[this.turnIndex]?.id === human.id && !human.folded && !human.allIn;

    const toCall = Math.max(0, this.currentBet - human.currentBet);

    const maxRaiseTo = human.currentBet + human.chips;
    const fullRaiseTarget = this.currentBet + Math.max(1, this.lastRaiseSize);

    const minRaiseTo = maxRaiseTo > this.currentBet
      ? Math.min(fullRaiseTarget, maxRaiseTo)
      : fullRaiseTarget;

    const canRaise = isHumanTurn && maxRaiseTo > this.currentBet;

    const dealer = this.players[this.dealerIndex] ?? null;
    const smallBlind = this.players[this.smallBlindIndex] ?? null;
    const bigBlind = this.players[this.bigBlindIndex] ?? null;

    return {
      running: this.running,
      state: this.state,
      message: this.message,
      pot: this.pot,
      currentBet: this.currentBet,
      turnPlayerId: this.players[this.turnIndex]?.id ?? null,
      isHumanTurn,
      callAmount: toCall,
      minRaiseTo,
      maxRaiseTo,
      communityCards: this.communityCards.map(card => card.toString()),
      humanCards: human.cards.map(card => card.toString()),
      dealerPlayerId: dealer?.id ?? null,
      smallBlindPlayerId: smallBlind?.id ?? null,
      bigBlindPlayerId: bigBlind?.id ?? null,
      smallBlindAmount: this.smallBlindAmount,
      bigBlindAmount: this.bigBlindAmount,
      players: this.players.map(player => ({
        id: player.id,
        name: player.name,
        chips: player.chips,
        currentBet: player.currentBet,
        contributedThisHand: player.contributedThisHand,
        folded: player.folded,
        allIn: player.allIn,
        lastAction: player.lastAction,
        isHuman: player.isHuman,
      })),
      availableActions: {
        fold: isHumanTurn,
        check: isHumanTurn && toCall === 0,
        call: isHumanTurn && toCall > 0,
        raise: canRaise,
      },
      suggestedRaiseTo: clamp(
        this.currentBet + Math.max(this.bigBlindAmount, this.lastRaiseSize),
        minRaiseTo,
        Math.max(minRaiseTo, maxRaiseTo),
      ),
    };
  }
}
