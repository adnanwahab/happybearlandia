---
title: probability of board games
---

# Dungeons and Dragons

Understanding the math behind Dungeons & Dragons shifts your decisions from pure guessing to calculated strategy. Master the d20 mechanics first, and strategic spell selection follows naturally.1. D20 Probability FundamentalsA standard 20-sided die (d20) has a uniform distribution: each face has exactly a 5% chance of landing.$$\text{Probability per face} = \frac{1}{20} = 0.05 \text{ or } 5\%$$Calculating Success RatesTo meet or beat a target number (Armor Class or Difficulty Class) after applying modifiers:$$\text{Success Chance} = (21 - \text{Target Number Needed}) \times 5\%$$Targeting a 11 or higher: You have 10 successful outcomes ($21 - 11 = 10$), giving you a 50% chance.Targeting a 15 or higher: You have 6 successful outcomes ($21 - 15 = 6$), giving you a 30% chance.Advantage and DisadvantageAdvantage allows you to roll two d20s and take the higher value; Disadvantage forces you to take the lower value.Advantage Formula: Chance of at least one die meeting target $T$:$$P(\text{Success}) = 1 - \left(\frac{T - 1}{20}\right)^2$$Disadvantage Formula: Chance of both dice meeting target $T$:$$P(\text{Success}) = \left(\frac{21 - T}{20}\right)^2$$Rule of Thumb: Advantage shifts your expected roll by roughly +3.32 to +5 depending on the target, peaking near a target threshold of 11 (where success jumps from 50% to 75%).2. Choosing Spells Based on ScenariosSpells fall into three primary tactical categories: Control/Debuff, Damage (AoE/Single Target), and Utility/Defense. Matching the right tool to the combat layout minimizes wasted spell slots.ScenarioPrimary ObjectiveIdeal Spell ProfileKey ExamplesLarge Mob of Weak EnemiesAction Economy ControlArea-of-Effect (AoE) or Area ControlWeb, Hypnotic Pattern, FireballSingle Strong "Boss" MonsterDebuffing / Sapping ActionsSave-or-Tether / Single-Target ControlHold Person, Tasha's Hideous Laughter, SlowHigh Armor Class (AC) EnemiesBypassing High DefenseSaving Throw Spells (Targeting weak stats)Sacred Flame, Toll the Dead, ShatterHigh Saving Throw EnemiesGuaranteed ImpactAttack Rolls (to leverage Advantage) or No-Save SpellsMagic Missile, Spiritual Weapon, Armor of AgathysAmbushed / OutpositionedParty Survival & EscapeDefensive Reactions & MobilityShield, Absorb Elements, Misty Step3. How to Weigh Risk vs. RewardStrategic decision-making in D&D revolves around Expected Value (EV) and Action Economy.Evaluating Expected ValueExpected Value measures the average outcome over repeated uses:$$\text{EV} = P(\text{Hit/Fail}) \times \text{Damage or Effect On Hit} + P(\text{Miss/Save}) \times \text{Effect On Miss}$$Single Target Damage vs. Crowd Control:Dealing 28 damage to one target with Scorching Ray might kill one minion. However, casting Hypnotic Pattern to incapacitate four enemies for 2 rounds strips away 8 enemy actions, yielding vastly superior damage mitigation for the entire party.The "Save-or-Nothing" DilemmaSingle-target control spells like Hold Person offer massive rewards (paralyzing a boss lets melee allies score automatic critical hits), but carry high risk:If the boss makes their saving throw, you waste a Level 2+ spell slot and your entire turn (0% value).Risk Mitigation: Target the enemy's weakest ability score (e.g., target a big brute's low Intelligence or Wisdom rather than their high Constitution).The Golden Framework for Spell SelectionIdentify the Threat Matrix: Are there many targets or one? What are their probable weak stats (Big/Strong = low Dex/Wis; Small/Fast = low Str; Caster = low Con)?Prioritize Action Economy: Spells that deny enemy turns (Sleep, Slow, Hypnotic Pattern) almost always yield higher EV than raw damage.Keep Guaranteed Value in Reserve: Always keep at least one non-concentration reaction (Shield or Absorb Elements) or zero-risk spell (Magic Missile) to ensure your turn contributes even when RNG is against you.

# Settlers of Cataan

Unlike Blackjack or Poker where card counting tracks a depleting deck, "card counting" in Settlers of Catan tracks a dynamic inventory model combined with imperfect information tracking. You aren't predicting what card comes next from a hidden stack; you are tracking what resources opponents hold in their hands to optimize trading, robber placement, and Monopoly card timing.
1. Core Mathematical Concepts for Tracking Catan Hands
Deterministic State Tracking (The Ledger)

In Catan, resource generation is completely public:

    Every dice roll produces specific resources based on hex placements (P(2)=361​,P(6)=365​, etc.).

    You know each player's starting hand from initial settlements.

    Every public purchase (Road = 1 Wood, 1 Brick; City = 2 Wheat, 3 Ore) subtracts precise values from their inventory.

This part requires basic ledger accounting, not complex probability. If Player A gains 2 Wheat and 1 Ore, then buys a Road, their hand contains at least 2 Wheat and 1 Ore plus whatever unaccounted cards they held previously.
Probability distributions across 2d6 dice rolls. Source: KOPE AI
Bayesian Inference (Probabilistic Tracking)

Uncertainty enters through stealing (Robber) and non-public trades (e.g., 4:1 maritime trades where you don't see what they traded away, or trade offers).

When Player B steals 1 random card from Player A (who holds 2 Brick and 1 Wheat), you update your belief matrix using Bayes' Theorem:
P(Player B stole Wheat)=Total cards in A’s handCount of Wheat in A’s hand​=31​

Over multiple turns, you track a probability distribution over the opponent's hand composition rather than exact counts.
Hidden Information & Signaling (Information Theory)

Opponent behavior acts as a noisy signal:

    Trade Willingness: If Player C actively tries to trade away Wood for Ore, the probability that they hold Wood approaches 100%, while their probability of holding Ore approaches 0%.

    Monopoly Value: The Expected Value (EV) of playing a Monopoly card on resource R is:
    EV(MonopolyR​)=i=1∑N​E[Resource R in Player i’s Hand]

2. Can You Use Decision Forests?

Yes, but with key caveats. A standard Random Forest or Decision Tree can work, but it is not the ideal architecture for playing Catan or card counting in real time.
Decision branching across probabilistic states. Source: Analytica Docs
How Decision Trees / Forests Apply

A Decision Tree classifies an action based on feature splits:

    Features: Opponent hand sizes, visible production rates, dice history, victory points, port access.

    Outcome: Classify whether to place Robber on Hex X vs. Hex Y, or play a Monopoly card now vs. wait.

Random Forests aggregate hundreds of these trees to prevent overfitting, making them effective for predicting:

    Hidden Hand State: Predicting the likelihood an opponent has a target resource based on their past actions.

    Trade Acceptance: Estimating the likelihood an opponent will accept a specific trade proposal.

Why Decision Forests Aren't the Full Solution

Catan has sequential, multi-agent dynamics with changing board states. Random Forests are static classifiers/regressors—they do not handle multi-turn lookahead or strategic opponent reactions natively.

To model optimal decisions over time, AI systems for Catan combine several architectures:
Mathematical/AI Framework	Role in Catan Strategy
Bayesian Networks	Tracking hidden hand contents under uncertainty (steals, trades).
Monte Carlo Tree Search (MCTS)	Simulating future turns and dice rolls to pick the best move tree (similar to Chess/Go AI).
Reinforcement Learning (Q-Learning / Deep Q-Networks)	Evaluating board value and learning long-term positional advantages.
Random Forests / Gradient Boosting	Quick feature-based classification (e.g., evaluating static settlement locations or trade acceptance probabilities).
Practical Mental Framework for Gameplay

To implement "card counting" at the table without a computer:

    Track the Scarcity Resource: Only count the 1–2 resources that are currently scarce on the board (e.g., if Ore is rare, only track who received Ore on 8 or 11 rolls).

    Track the "4-Card Rule": When an opponent holds 4 or more cards and passes their turn without building, they are usually holding high-value combinations (Cities/Development Cards) and lack only 1 resource to execute.

    Audit Before Monopoly: Calculate the total generated supply of a resource since the last major build phase to maximize your Monopoly returns.

# Using simulation to predict

We can use story based  simualtors to visualize
conversations. Then when people learn by interacting with the simulator, they are able to predict what others may think in advance.

Spice from Dune by Frank Herbert allowed people
to predict the future. Here are some examples of systems that predict that we use frequently.

This is why we want to label games and make games with this in mind.

# Navigating conversations
