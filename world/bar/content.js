// Original dialogue for The Social Bear. All patrons are fictional adults.
// Scores describe how a particular joke lands, never an entitlement to a date.
// Drinks are fictional purchases and do not alter attraction or willingness.

const round = (id, stage, prompt, rows) => ({
  prompt,
  choices: rows.map(([label, style, text, response, score, reactions], index) => ({
    id: `${id}-${stage}-${index + 1}`,
    stage,
    style,
    label,
    text,
    response,
    score,
    ...(reactions ? { reactions } : {}),
  })),
});

export const DRINKS = [
  { id: 'water', name: 'Water, confidently', price: 0, description: 'Still water. Excellent at its job.', alcoholic: false },
  { id: 'lime-soda', name: 'Lime soda', price: 4, description: 'Bubbles, lime, and very little drama.', alcoholic: false },
  { id: 'mocktail', name: 'Plot Twist', price: 7, description: 'A bright berry and ginger mocktail. The twist is lime.', alcoholic: false },
  { id: 'beer', name: 'House beer', price: 6, description: 'A crisp lager with absolutely no life advice.', alcoholic: true },
  { id: 'wine', name: 'House wine', price: 8, description: 'A glass of red with an unnecessarily confident description.', alcoholic: true },
  { id: 'cocktail', name: 'Bear Necessities', price: 10, description: 'A citrus cocktail wearing a tiny paper umbrella.', alcoholic: true },
];

export const PATRONS = [
  {
    id: 'nova', name: 'Nova', age: 28, gender: 'woman', role: 'Film restorer', color: '#d88aff', groupId: 'booth',
    bio: 'Restores old movies. Has extremely strong opinions about background extras.',
    clue: 'She gives a napkin swan a tiny suit. Absurd stories and committing to a bit make her laugh.',
    likes: ['absurd', 'playful'], dislikes: ['bold'],
    drinks: ['water', 'lime-soda', 'mocktail', 'wine'], favoriteDrink: 'wine',
    drinkHint: 'Wine or something without alcohol. No beer or cocktails tonight.',
    drinkReply: 'Thanks. My napkin manager approves this refreshment break.',
    drinkDecline: 'Thanks for asking, but that is not my drink. No need to order it.',
    opening: 'This swan just informed me our department is being restructured.',
    reactions: { great: 'Nova laughs, then immediately adds to the bit.', good: 'Nova smiles and leans into the conversation.', miss: 'Nova looks at the swan. The swan has notes.' },
    decline: 'You are fun, but I am not feeling the date version of this.',
    contact: 'Let us swap contacts. I will send you a movie that needs a second witness.',
    friend: 'Join movie night. Group chat first; romantic subplot still in development.',
    inviteText: 'Want to see a terrible movie with me and defend it afterward?',
    dateTitle: 'Bad Movie, Excellent Commentary',
    date: 'Yes. We each have to give it five stars for a completely different reason.',
    recovery: 'Fair. I will tell the swan we explored a strategic partnership.',
    recoveryReply: 'He respects your professionalism.',
    rounds: {
      opener: round('nova', 'opener', 'This swan just informed me our department is being restructured.', [
        ['Ask about benefits', 'absurd', 'Does he offer dental, or is it strictly a beak situation?', 'Terrible benefits. Incredible migration package. You are hired.', 2],
        ['Respect the manager', 'playful', 'I was going to flirt, but I do not want to undermine your manager.', 'He is surprisingly supportive. Just keep it off company time.', 1],
        ['Ask about her evening', 'sincere', 'What brought you out tonight?', 'I restored a three-hour film about a man missing a train. I needed different chairs.', 1],
        ['Make a grand entrance', 'bold', 'Good news. The most interesting person in this bar just arrived.', 'The swan? Yes. We are all very excited.', -1],
      ]),
      story: round('nova', 'story', 'The swan has approved a very small budget for employee morale.', [
        ['Organize the workforce', 'absurd', 'We need to unionize before he replaces us with origami.', 'Finally. Someone with a long-term vision for napkin labor.', 2],
        ['Ask about a favorite film', 'sincere', 'What movie would you rescue if you could save only one?', 'The awful home movie where my dad tries to teach a dog chess.', 1],
        ['Offer a sensible budget', 'dry', 'One olive per employee. Two if we meet our targets.', 'Austerity has finally reached the garnish department.', 1],
        ['Outdo the swan', 'bold', 'I could probably fold a much bigger swan.', 'That is how every company ends up with a terrible CEO.', 0],
      ]),
      flirt: round('nova', 'flirt', 'The swan wants to know whether this conversation has a future.', [
        ['Pitch the sequel', 'absurd', 'Two charming fools. One terrible movie. No studio willing to intervene.', 'I would watch that. Especially if we get final cut.', 2],
        ['Be straightforward', 'sincere', 'I am enjoying talking to you. I would like to see you again.', 'That is a good line without needing a screenplay.', 1],
        ['Offer a callback', 'playful', 'I will run it past your manager. Would a breadcrumb help?', 'He cannot be bribed. He can, however, be lightly toasted.', 2],
        ['Promise a blockbuster', 'bold', 'A date with me would be the greatest night of your life.', 'That is a lot of pressure to put on a Tuesday.', -1],
      ]),
    },
  },
  {
    id: 'maya', name: 'Maya', age: 31, gender: 'woman', role: 'Firefighter', color: '#ff956b', groupId: 'high-tops',
    bio: 'Calm in emergencies. Less calm about restaurants serving food on roof tiles.',
    clue: 'She surveys one tiny snack on a giant board. She likes dry observations and quiet, sincere conversation.',
    likes: ['dry', 'sincere'], dislikes: ['bold'],
    drinks: ['water', 'lime-soda', 'mocktail'], favoriteDrink: 'lime-soda',
    drinkHint: 'Alcohol-free tonight. Lime soda is her favorite.',
    drinkReply: 'Thanks for checking. Something alcohol-free is perfect.',
    drinkDecline: 'No alcohol for me tonight, thanks. A lime soda would work.',
    opening: 'This is apparently a sharing plate. We are sharing the disappointment.',
    reactions: { great: 'Maya lets out a quiet laugh and gives you an approving look.', good: 'Maya smiles. You have her attention.', miss: 'Maya raises one eyebrow. It does most of the talking.' },
    decline: 'Thanks, but I do not feel that spark.',
    contact: 'Sure. Swap contacts? You can help me find a restaurant with normal plates.',
    friend: 'I would join a group round of mini golf. You are good company; I am keeping it friendly.',
    inviteText: 'Mini golf sometime? I promise to lose with quiet dignity.',
    dateTitle: 'Mini Golf, Minor Grievances',
    date: 'Thursday. And I expect the dignity to last at least two holes.',
    recovery: 'Understood. We can still testify against this dinnerware.',
    recoveryReply: 'I will give a statement.',
    rounds: {
      opener: round('maya', 'opener', 'This is apparently a sharing plate. We are sharing the disappointment.', [
        ['Review the portion', 'dry', 'They have really captured the experience of not having dinner.', 'Exactly. And somehow made it more expensive.', 2],
        ['Start a business', 'absurd', 'We could ask for two more plates and start a furniture store.', 'Finally, a business with less overhead than these fries.', 1],
        ['Check in', 'sincere', 'Long day? I am happy to listen.', 'Very. Nobody needed rescuing, but a printer tried my patience.', 1],
        ['Try a fiery line', 'bold', 'Are you always this hot, or is that an occupational hazard?', 'My profession has suffered enough.', -1],
      ]),
      story: round('maya', 'story', 'They have brought another plate. The meal now occupies three postal codes.', [
        ['Set a life goal', 'dry', 'A single sensible bowl. That is my five-year plan.', 'Ambitious. But I like someone who knows what they want.', 2],
        ['Ask about time off', 'sincere', 'What does a really good night off look like for you?', 'Good company, terrible mini golf, and absolutely no rescue missions.', 1],
        ['Offer a tiny adventure', 'playful', 'Shall we explore the far side of the plate? We may need supplies.', 'Take the ketchup. It is the only local landmark.', 1],
        ['Perform a stunt', 'bold', 'I could juggle these plates.', 'I would prefer to meet you somewhere other than an incident report.', -1],
      ]),
      flirt: round('maya', 'flirt', 'All right. What does your idea of a good date look like?', [
        ['Set reasonable expectations', 'dry', 'Decent company. Actual food. Nobody describing themselves as an entrepreneur.', 'A suspiciously good pitch. I am listening.', 2],
        ['Say what matters', 'sincere', 'Somewhere we can talk and both feel comfortable.', 'That is an excellent place to start.', 1],
        ['Volunteer as mini-golf rival', 'playful', 'Mini golf. You win. I blame a very localized weather event.', 'Indoors? Impressive commitment to the excuse.', 2],
        ['Make a heroic promise', 'bold', 'I will sweep you off your feet. Literally.', 'I would like to retain control of my feet.', -1],
      ]),
    },
  },
  {
    id: 'ivy', name: 'Ivy', age: 27, gender: 'woman', role: 'Florist', color: '#b5ea80', groupId: 'dancefloor',
    bio: 'Names every plant. Maintains a complicated feud with one fern.',
    clue: 'She laughs before finishing her own plant pun. She loves playful wordplay and someone joining the bit.',
    likes: ['playful', 'absurd'], dislikes: ['dry'],
    drinks: ['water', 'lime-soda', 'mocktail', 'cocktail'], favoriteDrink: 'mocktail',
    drinkHint: 'A berry mocktail is her favorite. Beer and wine are not her thing.',
    drinkReply: 'Thank you! I am calling the garnish Gerald.',
    drinkDecline: 'Not my usual, thanks. I would enjoy the berry mocktail, though.',
    opening: 'My fern is giving me the silent treatment. It is being frond and distant.',
    reactions: { great: 'Ivy laughs with her whole shoulders. The pun has found its people.', good: 'Ivy grins and makes room for your part of the story.', miss: 'Ivy gives the imaginary fern a sympathetic look.' },
    decline: 'I like your jokes, but I am not feeling a romantic connection.',
    contact: 'Yes, let us swap contacts. You need updates on the fern situation.',
    friend: 'Come to the plant swap. You have excellent friend-shaped energy.',
    inviteText: 'Want to visit the plant market together? I can carry the emotional baggage.',
    dateTitle: 'A Very Complicated Plant Market',
    date: 'Yes. If you make a bouquet pun, I am blaming you for the whole afternoon.',
    recovery: 'Fair enough. I will not shrub it in.',
    recoveryReply: 'An excellent farewell pun. I respect the craft.',
    rounds: {
      opener: round('ivy', 'opener', 'My fern is giving me the silent treatment. It is being frond and distant.', [
        ['Find the root cause', 'playful', 'Have you tried addressing the root of the problem?', 'Oh no. You are enabling me. This could become serious.', 2],
        ['Offer mediation', 'absurd', 'I can mediate. I have no qualifications, which makes me impartial.', 'Perfect. Neither party understands what the argument is about.', 2],
        ['Ask about her plants', 'sincere', 'How long have you had the fern?', 'Six years. Two apartments. One very upsetting vacuum.', 1],
        ['Deliver a diagnosis', 'dry', 'Your plant has discovered the advantages of not speaking.', 'Rude. Accurate, but rude.', 0],
      ]),
      story: round('ivy', 'story', 'Now the cactus has taken the fern\'s side. I thought it had better boundaries.', [
        ['Suggest a fresh start', 'playful', 'Time to turn over a new leaf. Separately. The fern needs space.', 'That was awful. I would like another one immediately.', 2],
        ['Ask about the gossip', 'absurd', 'What does the fern call you behind your back?', 'The sprinkler with shoes. Honestly, fair.', 2],
        ['Ask what she enjoys', 'sincere', 'What do you love about working with plants?', 'Helping people keep a tiny living thing happy. Also, no meetings.', 1],
        ['Make a purchase offer', 'bold', 'I will buy you the biggest fern in the city.', 'That would create a succession crisis.', 0],
      ]),
      flirt: round('ivy', 'flirt', 'You have now met my entire household, botanically speaking.', [
        ['Make a plant pun', 'playful', 'I like you. I am trying very hard not to say we have good chemis-tree.', 'You failed beautifully. That is a promising quality.', 2],
        ['Speak plainly', 'sincere', 'I like your enthusiasm. I would enjoy spending more time together.', 'That is a lovely thing to say.', 1],
        ['Respect the household', 'absurd', 'If we go out, does the cactus conduct the background check?', 'Yes. Thorough, but mostly interested in your watering schedule.', 2],
        ['Play it too cool', 'dry', 'This is tolerable company. I could probably fit in another hour.', 'A glowing review. I will alert the fern.', -1],
      ]),
    },
  },
  {
    id: 'theo', name: 'Theo', age: 30, gender: 'man', role: 'Urban planner', color: '#7cc8ff', groupId: 'booth',
    bio: 'Can identify a bad intersection from three neighborhoods away.',
    clue: 'He builds a pretzel roundabout. Dry observations and oddly practical absurdity are his thing.',
    likes: ['dry', 'absurd'], dislikes: ['bold'],
    drinks: ['water', 'lime-soda', 'beer'], favoriteDrink: 'beer',
    drinkHint: 'Beer, lime soda, or water. He keeps the menu simple.',
    drinkReply: 'Thank you. Efficient routing from the bar to this table.',
    drinkDecline: 'I will pass on that one, thanks. Beer or lime soda works for me.',
    opening: 'The pretzels have better traffic flow than my commute.',
    reactions: { great: 'Theo laughs and points as though you just solved a city planning dispute.', good: 'Theo smiles and shifts his chair toward you.', miss: 'Theo considers the line like a questionable parking proposal.' },
    decline: 'I appreciate it, but I do not feel that kind of chemistry.',
    contact: 'Let us swap contacts. I know a footbridge you would appreciate.',
    friend: 'I would enjoy showing you around. Let us make it a friend outing.',
    inviteText: 'Walk to your favorite footbridge with me another evening?',
    dateTitle: 'The Unofficial Bench Inspection',
    date: 'Yes. We can rate benches with unnecessary seriousness.',
    recovery: 'No problem. A sensible junction with clearly marked exits.',
    recoveryReply: 'That is, annoyingly, very charming.',
    rounds: {
      opener: round('theo', 'opener', 'The pretzels have better traffic flow than my commute.', [
        ['Identify the improvement', 'dry', 'None of them are trying to merge while sending an email.', 'Finally, somebody brave enough to address the real infrastructure crisis.', 2],
        ['Move into pretzel town', 'absurd', 'I would live there. Walkable. Affordable. Slightly salty.', 'Do not announce that. A developer will add luxury mustard.', 2],
        ['Ask about his work', 'sincere', 'What part of the city would you most like to improve?', 'The crossing outside my library. Getting to a book should not require sprinting.', 1],
        ['Try a classic', 'bold', 'Are you a parking ticket? Because you have fine written all over you.', 'You found the one ticket this profession cannot appeal.', 0],
      ]),
      story: round('theo', 'story', 'What is one thing every neighborhood needs?', [
        ['Propose an amenity', 'dry', 'A bench, a bakery, and no one selling me a productivity seminar.', 'You just described my entire political platform.', 2],
        ['Ask for his favorite spot', 'sincere', 'Show me your favorite place in the city.', 'There is a footbridge where the skyline looks like it is trying its best.', 1],
        ['Design an unusual park', 'absurd', 'A park where pigeons have to apply for a permit to judge you.', 'Finally. Some accountability in public space.', 2],
        ['Think bigger', 'bold', 'A twenty-lane road. Really let people commit.', 'Someone is already drawing that on a funding application.', -1],
      ]),
      flirt: round('theo', 'flirt', 'I have talked a lot about benches. Somehow you are still here.', [
        ['Explain the attraction', 'dry', 'You have strong opinions about places to sit. I am planning for the future.', 'Practical and vaguely threatening to my independence. I like it.', 2],
        ['Be honest', 'sincere', 'I like hearing you talk about things you care about.', 'Then I should warn you: I have a second favorite footbridge.', 1],
        ['Propose a tiny expedition', 'absurd', 'We should inspect the city. Two clipboards. Absolutely no authority.', 'We will be unstoppable until someone asks a follow-up question.', 2],
        ['Make it exclusive already', 'bold', 'Cancel your other plans. You are going out with me.', 'That proposal needs considerably more public consultation.', -1],
      ]),
    },
  },
  {
    id: 'jax', name: 'Jax', age: 26, gender: 'man', role: 'Jazz drummer', color: '#ffd76c', groupId: 'dancefloor',
    bio: 'Enthusiastic dancer. Owns one jacket that has its own reputation.',
    clue: 'He celebrates strangers winning darts. He likes playful sincerity and bold, harmless silliness.',
    likes: ['playful', 'bold'], dislikes: ['dry'],
    drinks: ['water', 'lime-soda', 'mocktail', 'beer', 'cocktail'], favoriteDrink: 'lime-soda',
    drinkHint: 'Lime soda is a favorite. Anything except wine is welcome.',
    drinkReply: 'Thanks! The jacket would like to toast your excellent manners.',
    drinkDecline: 'Not a wine person, thanks. A lime soda would be great.',
    opening: 'Is this jacket confident, or is it making promises I cannot keep?',
    reactions: { great: 'Jax laughs and does a small, completely unnecessary victory dance.', good: 'Jax beams. The jacket seems pleased too.', miss: 'Jax pauses. Even the jacket looks a little less certain.' },
    decline: 'You are cool, but I do not feel a romantic spark.',
    contact: 'Absolutely. Swap contacts? I will send you the next concert.',
    friend: 'Come with our group. Dance partnership: yes. Dating: let us keep it friendly.',
    inviteText: 'Want to dance with me at the outdoor concert this weekend?',
    dateTitle: 'Several Questionable Dance Moves',
    date: 'Absolutely. I will bring the jacket. You bring the questionable dance move.',
    recovery: 'No worries. Our skeletons can remain professional acquaintances.',
    recoveryReply: 'Mine will send yours a networking request.',
    rounds: {
      opener: round('jax', 'opener', 'Is this jacket confident, or is it making promises I cannot keep?', [
        ['Read the jacket', 'playful', 'The jacket has a helicopter. You seem like you would help me move a sofa.', 'Both are true. The helicopter is a very small print on the lining.', 2],
        ['Let it introduce you', 'bold', 'I am going to flirt with the jacket first and work my way up.', 'Sensible. It is the more socially experienced one.', 2],
        ['Give a real compliment', 'sincere', 'It suits you. You look like you are having a good time.', 'I am. There is good music and nobody has requested Wonderwall yet.', 1],
        ['Evaluate the investment', 'dry', 'That is a lot of jacket for one person.', 'I know. Occasionally I take a shift off.', 0],
      ]),
      story: round('jax', 'story', 'The jacket requests one dance move. What is our opening statement?', [
        ['Demonstrate a new dance', 'bold', 'The dance where you realize the oven might still be on.', 'Incredible. Urgency in the shoulders. Regret in the knees.', 2],
        ['Ask for the worst move', 'playful', 'Teach me your worst move. I want to start somewhere achievable.', 'Excellent. This one is called Office Chair Escaping Downhill.', 2],
        ['Ask about his music', 'sincere', 'What do you enjoy most about playing music with people?', 'When we all stop thinking and find the same rhythm. Hard to beat.', 1],
        ['Keep a straight face', 'dry', 'I prefer to conserve my dignity for tax season.', 'Respectable, but your knees look bored.', 0],
      ]),
      flirt: round('jax', 'flirt', 'I think we have invented a dance. We may owe somebody an apology.', [
        ['Own the disaster', 'bold', 'I would like to make more questionable artistic decisions with you.', 'That is the best invitation the jacket has heard all year.', 2],
        ['Make a joint plan', 'playful', 'We need a second rehearsal. The office chair is still escaping.', 'Then it is settled: somebody needs to supervise that chair.', 2],
        ['Say what you feel', 'sincere', 'I like your energy. I would enjoy getting to know you.', 'I would enjoy that conversation too.', 1],
        ['Review the performance', 'dry', 'Acceptable. I have seen less effective movement in a queue.', 'You really know how to make a skeleton feel special.', -1],
      ]),
    },
  },
  {
    id: 'owen', name: 'Owen', age: 34, gender: 'man', role: 'Librarian', color: '#a79dff', groupId: 'high-tops',
    bio: 'Quietly funny. Has written an elaborate review of the bar\'s chair.',
    clue: 'He quietly smiles at a typo. He enjoys dry wit and wordplay; being put in the spotlight makes him uncomfortable.',
    likes: ['dry', 'playful'], dislikes: ['bold'],
    drinks: ['water', 'lime-soda', 'mocktail'], favoriteDrink: 'mocktail',
    drinkHint: 'Only alcohol-free drinks. He likes the berry mocktail.',
    drinkReply: 'Thank you. This is an excellent chapter in the evening.',
    drinkDecline: 'I do not drink alcohol, but thank you for asking. The mocktail sounds nice.',
    opening: 'The menu promises live mussels. I hope they know a few songs.',
    reactions: { great: 'Owen laughs into his hand, then looks up to catch your eye.', good: 'Owen smiles and sets the menu down.', miss: 'Owen glances at the menu as though looking for a quieter chapter.' },
    decline: 'That is kind, but I am not looking for that connection with you.',
    contact: 'Yes. Let us swap contacts. I have an unreasonable number of book recommendations.',
    friend: 'I would enjoy a bookshop visit as friends. We can still be terrible critics.',
    inviteText: 'Bookshop and coffee sometime? We can judge books by their covers.',
    dateTitle: 'Coffee and Unreliable Narrators',
    date: 'Yes. Quietly, but with devastating accuracy.',
    recovery: 'Understood. A graceful ending. Excellent pacing.',
    recoveryReply: 'And no unnecessary sequel. Five stars.',
    rounds: {
      opener: round('owen', 'opener', 'The menu promises live mussels. I hope they know a few songs.', [
        ['Review the band', 'playful', 'I have heard their early work. Very shellfish with the solos.', 'They peaked before they went mainstream.', 2],
        ['Notice the opener', 'dry', 'The clams opened for them. Terrible crowd work.', 'And yet the reviews said the audience was hooked.', 2],
        ['Ask about his evening', 'sincere', 'Is this your usual spot?', 'Sometimes. I am conducting a long-term study of this unusually good chair.', 1],
        ['Announce the comedian', 'bold', 'Hey, everyone! Listen to this guy\'s joke!', 'Please do not announce me like a suspicious item at airport security.', -1],
      ]),
      story: round('owen', 'story', 'Since the menu has become literature: what book should actually exist?', [
        ['Propose a short mystery', 'dry', 'A murder mystery where the detective asks one sensible question.', 'Three pages. Bestseller. Impossible to adapt into eight episodes.', 2],
        ['Write a niche handbook', 'playful', 'How to Leave a Party Without Accidentally Starting a Second Conversation.', 'I would put that by the exit. For obvious reasons.', 2],
        ['Ask for a recommendation', 'sincere', 'What book would you love to read for the first time again?', 'The one I borrowed from my mother and still have not returned. She has notes.', 1],
        ['Pitch an autobiography', 'bold', 'My autobiography. It would need several volumes.', 'I will reserve an appropriately ambitious shelf.', 0],
      ]),
      flirt: round('owen', 'flirt', 'This has been a surprisingly good conversation for a room with a disco ball.', [
        ['Suggest another chapter', 'dry', 'I would read a sequel. Similar characters, fewer live mussels.', 'An excellent editorial note. I would be interested in that.', 2],
        ['Offer a quiet compliment', 'sincere', 'I like your sense of humor. I would like to talk again.', 'Thank you. I am glad you came over.', 1],
        ['Make a bookish admission', 'playful', 'I was going to play hard to get, but I have already renewed this conversation twice.', 'There are exceptions for particularly good borrowers.', 2],
        ['Declare a romantic epic', 'bold', 'We are obviously the main characters in this entire bar.', 'Could we be the interesting people in the footnotes instead?', -1],
      ]),
    },
  },
];

export const GROUPS = [
  { id: 'booth', name: 'The Corner Conspiracy', subtitle: 'A napkin swan has seized the city council.', memberIds: ['nova', 'theo'], topic: 'Designing a tiny city out of bar snacks', clue: 'Nova loves an absurd story. Theo notices practical details and enjoys a dry punchline.' },
  { id: 'high-tops', name: 'The Review Committee', subtitle: 'Two excellent critics. One deeply suspicious menu.', memberIds: ['maya', 'owen'], topic: 'Reviewing the bar with unnecessary seriousness', clue: 'Maya likes understated observations. Owen loves wordplay and prefers a quiet exchange.' },
  { id: 'dancefloor', name: 'The Questionable Moves', subtitle: 'No rhythm? That is just a new genre.', memberIds: ['ivy', 'jax'], topic: 'Inventing a dance nobody should have to explain', clue: 'Ivy loves a playful pun. Jax enjoys someone boldly joining the silliness.' },
];

export const GROUP_LINES = {
  booth: {
    opener: round('booth', 'opener', 'Nova has elected the napkin swan mayor. Theo is worried about pretzel zoning.', [
      ['Investigate the mayor', 'absurd', 'Has anyone checked whether the mayor is three pigeons in a napkin?', 'Nova gasps. Theo starts auditing the breadcrumbs.', 2, { nova: { score: 2, response: 'That explains the suspiciously enthusiastic parking policy.' }, theo: { score: 1, response: 'It would explain the sudden pedestrianization of every fountain.' } }],
      ['Review the plan', 'dry', 'I see you have already allocated most of the budget to decorative olives.', 'Theo nods gravely. Nova protects the olive budget.', 1, { nova: { score: 0, response: 'The arts are always the first to suffer.' }, theo: { score: 2, response: 'Finally. Someone read the budget.' } }],
      ['Ask to join', 'sincere', 'What is the story so far? This looks like a fun committee.', 'They make room and explain the extremely unofficial municipal crisis.', 1, { nova: { score: 1, response: 'Our mayor is a swan. Our constitution is a receipt.' }, theo: { score: 1, response: 'We could use a second opinion on the bus lanes.' } }],
      ['Take control', 'bold', 'Step aside. I will run this city.', 'The tiny city is not ready for a hostile takeover.', -1, { nova: { score: -1, response: 'The swan has requested your resignation in advance.' }, theo: { score: -1, response: 'We do actually have a consultation process.' } }],
    ]),
    story: round('booth', 'story', 'The swan mayor has promised affordable housing, but somebody ate the model homes.', [
      ['Propose a new district', 'absurd', 'Emergency crouton village. Every resident gets a tiny moat of soup.', 'Nova starts naming residents. Theo worries about the drainage.', 2, { nova: { score: 2, response: 'I already care deeply about all of them.' }, theo: { score: 1, response: 'Excellent transit access. Troubling flood risk.' } }],
      ['Diagnose the market', 'dry', 'The housing shortage appears to be entirely within chewing distance.', 'Theo laughs. Nova looks very innocent.', 1, { nova: { score: 1, response: 'I was conducting a taste inspection.' }, theo: { score: 2, response: 'The first planning objection I have personally swallowed.' } }],
      ['Offer to help', 'sincere', 'I can help rebuild. What does your little city need most?', 'You are assigned a small but meaningful public works project.', 1, { nova: { score: 1, response: 'A cinema. The swan has a documentary to premiere.' }, theo: { score: 1, response: 'A bench. I am nothing if not consistent.' } }],
      ['Sell the rescue plan', 'bold', 'Luxury toothpick towers. I will be rich by closing time.', 'The committee unanimously rejects your brochure.', -1, { nova: { score: -1, response: 'The swan says the vibes are speculative.' }, theo: { score: -1, response: 'You have invented all my least favorite emails.' } }],
    ]),
  },
  'high-tops': {
    opener: round('high-tops', 'opener', 'Maya is reviewing the snack board. Owen is reviewing the word "artisanal."', [
      ['Review the empty space', 'dry', 'The portion is small, but the plate gives it room to grow as a person.', 'Maya laughs. Owen makes a mental note.', 2, { maya: { score: 2, response: 'They charge extra for emotional growth.' }, owen: { score: 1, response: 'A coming-of-age story. Mostly age.' } }],
      ['Defend the menu', 'playful', 'Perhaps the cheese has a great personality. We should give it a gouda chance.', 'Owen smiles. Maya grants the cheese a brief interview.', 1, { maya: { score: 0, response: 'I will give it exactly one bite to impress me.' }, owen: { score: 2, response: 'That was mature. Unlike the cheese, apparently.' } }],
      ['Ask for the verdict', 'sincere', 'What would you recommend here?', 'They happily exchange actual recommendations.', 1, { maya: { score: 1, response: 'The lime soda and lowering your expectations of the olives.' }, owen: { score: 1, response: 'This chair. Five stars. The mocktail is good too.' } }],
      ['Start a public review', 'bold', 'Everyone, gather around! These two have something to announce!', 'Neither critic requested a press conference.', -1, { maya: { score: -1, response: 'We were enjoying an indoor volume.' }, owen: { score: -1, response: 'I would like to retract my existence from this announcement.' } }],
    ]),
    story: round('high-tops', 'story', 'The bartender asks whether they enjoyed the "immersive dining journey."', [
      ['Describe the journey', 'dry', 'A short walk from hungry to still hungry. Beautiful scenery.', 'Maya laughs. Owen approves the concise review.', 2, { maya: { score: 2, response: 'The return journey is surprisingly familiar.' }, owen: { score: 1, response: 'An evocative travelogue.' } }],
      ['Write the sequel', 'playful', 'The Lord of the Onion Rings: The Fellowship of the Very Small Portion.', 'Owen immediately requests a second volume.', 1, { maya: { score: 1, response: 'Does the second one contain dinner?' }, owen: { score: 2, response: 'One ring to feed them all. Ambitious catering.' } }],
      ['Give a fair review', 'sincere', 'The company is excellent. I am enjoying this table.', 'The critics pause their reviews to smile at you.', 1, { maya: { score: 1, response: 'That has definitely improved the rating.' }, owen: { score: 1, response: 'A fair and well-supported conclusion.' } }],
      ['Show off your standards', 'bold', 'I only eat at places celebrities cannot pronounce.', 'The committee declines to be impressed.', -1, { maya: { score: -1, response: 'I mostly eat at places with food.' }, owen: { score: 0, response: 'A challenging search filter.' } }],
    ]),
  },
  dancefloor: {
    opener: round('dancefloor', 'opener', 'Ivy and Jax are inventing a dance. So far it looks like a fern missing a bus.', [
      ['Name the dance', 'playful', 'The Frond Farewell. One last wave before the bus leaves.', 'Ivy loves the pun. Jax commits to the wave.', 2, { ivy: { score: 2, response: 'Finally. A dance with deep roots.' }, jax: { score: 1, response: 'I can work with the bus. It gives us a direction.' } }],
      ['Join with confidence', 'bold', 'Make room. My knees have been training for this inconvenience.', 'Jax makes a space. Ivy applauds your questionable knees.', 1, { ivy: { score: 1, response: 'We accept all species of embarrassing movement.' }, jax: { score: 2, response: 'Those knees understand the assignment.' } }],
      ['Ask to learn', 'sincere', 'Can you teach me the first step?', 'They slow down and welcome you into the dance.', 1, { ivy: { score: 1, response: 'First step: forgive yourself for the second step.' }, jax: { score: 1, response: 'Absolutely. We are also still finding it.' } }],
      ['Review from a distance', 'dry', 'This looks like a very preventable incident.', 'The dancers keep their good time going.', -1, { ivy: { score: -1, response: 'We are choosing not to prevent it.' }, jax: { score: -1, response: 'That is the exciting part.' } }],
    ]),
    story: round('dancefloor', 'story', 'The DJ points at your group. Apparently this dance needs a grand finale.', [
      ['Make it botanical', 'playful', 'We all freeze. Photosynthesis break.', 'Ivy strikes a plant pose. Jax discovers a new use for his elbows.', 2, { ivy: { score: 2, response: 'Finally, performance art I can water.' }, jax: { score: 1, response: 'I am a very confident shrub.' } }],
      ['Lead a tiny parade', 'bold', 'Three steps forward. A heroic turn. Apologize to nobody except the furniture.', 'Jax leads the procession. Ivy makes peace with a stool.', 1, { ivy: { score: 1, response: 'The stool accepts. The table wants time to think.' }, jax: { score: 2, response: 'That is the most responsible parade I have ever joined.' } }],
      ['Give them the spotlight', 'sincere', 'You two take the finale. I will be your very enthusiastic audience.', 'They finish with a flourish and thank you for joining in.', 1, { ivy: { score: 1, response: 'Every fern needs sunlight. This counts.' }, jax: { score: 1, response: 'Best audience member in the building.' } }],
      ['Check the time', 'dry', 'Could the finale be sitting down? I have had a lot of character development.', 'The dance concludes with a slightly confused bow.', 0, { ivy: { score: 0, response: 'A chair is technically a supporting character.' }, jax: { score: 0, response: 'A bold new direction for choreography.' } }],
    ]),
  },
};

// Optional flattened catalog for searching, replay, or a future dialogue editor.
export const DIALOGUE = PATRONS.flatMap(patron =>
  Object.values(patron.rounds).flatMap(conversation =>
    conversation.choices.map(choice => ({ ...choice, patronId: patron.id }))),
);

export const EVENTS = [
  {
    id: 'jukebox-review', title: 'The jukebox wants feedback',
    text: 'The jukebox asks: "On a scale of one to five, how emotionally supported do you feel by this bass line?"',
    choices: round('jukebox-review', 'event', '', [
      ['Submit a review', 'dry', 'I selected somewhat haunted.', 'The jukebox plays a single apologetic note.', 1],
      ['Support the bass line', 'playful', 'Five. It believed in me before anyone else did.', 'A nearby table gives the speaker an encouraging thumbs-up.', 1],
    ]).choices,
  },
  {
    id: 'coaster-award', title: 'An extremely minor ceremony',
    text: 'The bartender rings a bell: "Congratulations to table four for returning all the coasters." The trophy says BASIC CONSIDERATION.',
    choices: round('coaster-award', 'event', '', [
      ['Make an acceptance speech', 'absurd', 'I would like to thank gravity for keeping the coasters on the table.', 'The bartender solemnly shakes your hand.', 1],
      ['Applaud the achievement', 'sincere', 'Good work, table four. A solid contribution to society.', 'Table four accepts the praise with surprising dignity.', 1],
    ]).choices,
  },
  {
    id: 'karaoke-gap', title: 'Emergency karaoke substitution',
    text: 'The karaoke singer leaves to take a call from their dentist. The instrumental continues with nobody at the microphone.',
    choices: round('karaoke-gap', 'event', '', [
      ['Invent a furniture anthem', 'bold', 'This one goes out to every chair that has supported me.', 'A short, moving tribute to the seating arrangements follows.', 1],
      ['Form the judging panel', 'dry', 'We award the instrumental nine points for knowing when to stop talking.', 'Your table becomes an unnecessarily solemn judging panel.', 1],
    ]).choices,
  },
];
