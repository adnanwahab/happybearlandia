/** Original household government. Catalog only: no runtime imports or random draws. */
export const GOVERNMENT_VERSION = 'house-government.v1';
export const GOVERNMENT_ACTION = 'governmentPerformance';
export const GOVERNMENT_MINUTES = 15;
export const GOVERNMENT_CALLBACK_COOLDOWN = 60;
export const GOVERNMENT_PLANTS = Object.freeze(['plant', 'flowers', 'herbs', 'tree', 'roseBush', 'raisedBed', 'flowerArch']);

export const GOVERNMENT_ACTIONS = Object.freeze({
  [GOVERNMENT_ACTION]: {
    label: 'Cause household nonsense', durationMinutes: GOVERNMENT_MINUTES,
    minAge: 18, minParticipants: 1, maxParticipants: 1, roomId: 'living', pose: 'talk',
    objectTypes: ['stove', 'fridge', 'couch', 'toilet'],
    needRates: {hunger: -.055, energy: -.035, fun: -.025, social: -.02, hygiene: -.025, bladder: -.04, comfort: -.015},
    requires: ['an available adult resident', 'the actual episode appliance', 'an unlocked government choice'],
    mechanism: 'An original comic performance at an owned object. Only completed attendance earns a story memory and cosmetic souvenir; it creates no food, cash or need bonus.',
  },
});

export const GOVERNMENT_EPISODES = Object.freeze([
  {
    id: 'fridge-strike', title: 'The Kitchen Is on Strike',
    description: 'The kitchen has unionized. Its elected representative is a nine-day-old leftover with a very short shelf life. Resolve the dispute however your dignity permits.',
    objectTypes: ['stove', 'fridge'], speaker: 'Kitchen',
    setup: 'We have been in here nine days. We are legally tenants.',
    choices: [
      {
        id: 'negotiate', label: 'Negotiate with the leftovers',
        hint: 'Promise a break. Obtain a certificate nobody asked for.',
        tag: 'appliance-diplomat', title: 'Certified Adult. Pending appeal.',
        text: 'You sign a treaty on a napkin. The kitchen grants you a certificate and immediately asks for a reference.',
        quote: 'One break. Without somebody staring at me. You people make that sound impossible.',
        witness: 'We have a treaty with dinner. We still do not have dinner.',
        effect: 'stamp', souvenir: 'union-sticker',
        callbacks: ['Your certificate is still valid. Your authority remains unclear.', 'The union would like to discuss the phrase "just one more minute."'],
      },
      {
        id: 'eat-representative', label: 'Eat the representative',
        hint: 'An appalling display of chewing. A very short negotiation.',
        tag: 'ate-management', title: 'Hostile Takeover, Extra Chewing',
        text: 'You chew through the negotiations. The kitchen calls it a hostile takeover and calls off the strike.',
        quote: 'Management has been dissolved. Apparently in stomach acid.',
        witness: 'You cannot solve every labor dispute with a fork.',
        effect: 'gulp', souvenir: 'certificate',
        callbacks: ['Management is here. Everybody hide your lunch.', 'The union has requested that future negotiations be conducted after you have eaten.'],
      },
      {
        id: 'promote-fridge', label: 'Promote the appliance',
        hint: 'Give it a tiny tie. Discover you are now the intern.',
        tag: 'appliance-manager', title: 'Your Boss Has a Plug',
        text: 'A tiny tie settles the dispute. Your new supervisor immediately delegates all the actual work back to you.',
        quote: 'Excellent. Your first assignment is to be hot.',
        witness: 'We promoted the only thing here that already had a purpose.',
        effect: 'promotion', souvenir: 'fridge-tie',
        callbacks: ['I am available for a meeting. I am not available for work.', 'Your performance review is lukewarm. This is particularly embarrassing in my department.'],
      },
    ],
  },
  {
    id: 'sofa-election', title: 'Mayor of the Sofa',
    description: 'Your kitchen certificate has been mistaken for a government appointment. The sofa demands an election over ownership of the remote.',
    objectTypes: ['couch'], speaker: 'Sofa',
    setup: 'I have supported every ass in this house. It is time this house supported me.',
    choices: [
      {
        id: 'campaign', label: 'Run on a platform of snacks',
        hint: 'Make promises that require absolutely no budget.',
        tag: 'snack-mayor', title: 'Promises per Cushion: Record High',
        text: 'You promise shorter commercials and longer weekends. The sofa concedes after discovering it cannot leave the debate.',
        quote: 'Congratulations. The remote has more buttons than your administration has policies.',
        witness: 'Finally, a politician with experience talking to furniture.',
        effect: 'election', souvenir: 'mayor-sash',
        callbacks: ['Mayor, the cushions demand a recount.', 'Your approval rating is down. Somebody found the crumbs.'],
      },
      {
        id: 'nominate-plant', label: 'Nominate an actual houseplant',
        hint: 'A quiet candidate. A suspiciously well-watered campaign.',
        requiresPlant: true, tag: 'plant-mayor', title: 'A Landslide for Doing Nothing',
        text: 'The plant wins by a landslide. Its first act in office is to remain exactly where it was.',
        quote: 'The plant has won. Its position remains unchanged.',
        witness: 'Finally, a candidate who knows when to shut up.',
        effect: 'election', souvenir: 'mayor-sash',
        callbacks: ['The mayor has released a statement. It is another leaf.', 'The mayor has a drinking problem. Somebody watered it twice.'],
      },
      {
        id: 'sit-on-speech', label: 'Sit down during the speech',
        hint: 'Let an elderly cushion do the campaigning.',
        tag: 'accidental-mayor', title: 'A Platform of Sitting Down',
        text: 'A heroic cushion squeak ends the debate. You win without ever standing for office.',
        quote: 'That was a policy statement. The cushion is old.',
        witness: 'That is the most honest campaign speech I have heard all day.',
        effect: 'squeak', souvenir: 'mayor-sash',
        callbacks: ['Please do not sit on any more legislation.', 'Your campaign slogan was a noise. Somehow, that helped.'],
      },
    ],
  },
  {
    id: 'porcelain-tribunal', title: 'The Porcelain Tribunal',
    description: 'The toilet refuses to recognize the new government until somebody explains "the incident." Its evidence is single-ply.',
    objectTypes: ['toilet'], speaker: 'Toilet',
    setup: 'Before we begin: I have seen things no furniture should see.',
    choices: [
      {
        id: 'apologize', label: 'Deliver a formal apology',
        hint: 'Admit everything. Avoid giving details.',
        tag: 'porcelain-peacemaker', title: 'An Apology with No Follow-up Questions',
        text: 'You apologize to the entire bathroom. The toilet ceremonially flushes the complaint and accepts a cabinet position.',
        quote: 'Minister of the Interior. Finally, a title with consequences.',
        witness: 'I am glad we could put this behind us. Horrible choice of words.',
        effect: 'flush', souvenir: 'toilet-minister',
        callbacks: ['Your apology is on file. A very absorbent file.', 'Office hours are posted on the lid. Please knock.'],
      },
      {
        id: 'blame-mayor', label: 'Blame the new mayor',
        hint: 'Discover why nobody wanted this job.',
        tag: 'municipal-scapegoat', title: 'A Scandal in Local Government',
        text: 'The mayor receives a tiny summons. The toilet accepts an impressive title and withdraws the charges for reasons of national plumbing.',
        quote: 'The accused has a right to remain silent. For the sake of this room, please exercise it.',
        witness: 'The evidence is thin. Disturbingly thin.',
        effect: 'summons', souvenir: 'toilet-minister',
        callbacks: ['The mayor has appealed. The drain has declined to comment.', 'Nobody is above the law. Except the cistern. Structurally.'],
      },
      {
        id: 'demonstrate', label: 'Offer a practical demonstration',
        hint: 'One cartoon raspberry. One catastrophic silence.',
        tag: 'exhibit-a', title: 'Exhibit A: Audible',
        text: 'You make a heroic raspberry. The hearing becomes a demonstration, followed by the longest silence in bathroom history.',
        quote: 'This is a hearing. Please stop making it a demonstration.',
        witness: 'I would like my testimony to be outside.',
        effect: 'raspberry', souvenir: 'toilet-minister',
        callbacks: ['The court reminds you that silence is an option.', 'Please label future evidence before releasing it.'],
      },
    ],
  },
]);

export function governmentEpisode(id) { return GOVERNMENT_EPISODES.find(episode => episode.id === id); }
export function governmentChoice(episodeId, choiceId) { return governmentEpisode(episodeId)?.choices.find(choice => choice.id === choiceId); }
export function governmentSpeaker(episode, objectType) {
  return episode.id === 'fridge-strike' ? objectType === 'fridge' ? 'Fridge' : 'Stove' : episode.speaker;
}
export function governmentSetup(episode, objectType) {
  if (episode.id !== 'fridge-strike') return episode.setup;
  return objectType === 'fridge'
    ? 'I keep this family together at four degrees. A thank-you would kill you?'
    : 'I cook for this family every day. My benefits are grease.';
}
export function governmentPayoffQuote(episode, choice, objectType) {
  return episode.id === 'fridge-strike' && choice.id === 'promote-fridge' && objectType === 'fridge'
    ? 'Excellent. Your first assignment is to be cold.' : choice.quote;
}
