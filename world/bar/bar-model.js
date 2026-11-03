/** Pure rules for The Honey Pot. Every patron is a fictional adult; flirting stays playful and "no" always holds. */
export const BAR_OPEN_MINUTE=21*60,BAR_CLOSE_MINUTE=26*60,STARTING_CASH=60,MAX_LINE_LENGTH=220,PATRON_DRINK_LIMIT=3,PLAYER_CUTOFF=6,MAX_STRIKES=3,NUMBER_VIBE=70,LEAVE_VIBE=90,GOSSIP_PRICE=2;
export const HUMOR_STYLES=['pun','absurd','selfDeprecating','observational','cheesy'];
export const DRINKS=[
 {id:'lager',label:'Bear Claw Lager',price:6,alcohol:1,blurb:'Cold, cheap, honest.'},
 {id:'honeyOld',label:'Honey Old Fashioned',price:12,alcohol:1,blurb:'Smoky and a bit smug.'},
 {id:'paloma',label:'Salty Paloma',price:10,alcohol:1,blurb:'Grapefruit with a grudge.'},
 {id:'espresso',label:'Espresso Tini',price:13,alcohol:1,blurb:'Bad decisions, wide awake.'},
 {id:'shot',label:'Mystery Shot',price:7,alcohol:1,blurb:'The bartender will not elaborate.'},
 {id:'soda',label:'Honey Lemon Soda',price:4,alcohol:0,blurb:'Zero proof, full flavor.'},
 {id:'water',label:'Water',price:0,alcohol:0,blurb:'On the house. Always.'}
];
export const GROUPS=[
 {id:'veil',label:'The Veil Patrol',blurb:'A bachelorette party on a very strict itinerary.'},
 {id:'softball',label:'The Sliders',blurb:'Rec-league softball team, fresh off a loss.'},
 {id:'office',label:'Spreadsheet Club',blurb:'Coworkers pretending this is not a work event.'}
];
const person=(id,name,gender,age,job,drink,groupId,humor,look,signature,extra={})=>({id,name,gender,age,job,drink,groupId,humor,look,signature,...extra});
export const PATRONS=[
 person('priya','Priya','woman',29,'paralegal','paloma','veil',{pun:.5,absurd:.8,selfDeprecating:.6,observational:.9,cheesy:.2},{skin:'#a86f4c',hair:'#1d1412',style:'long',shirt:'#f7f1e6'},'Objection sustained, that was hilarious.',{taken:true}),
 person('dani','Dani','woman',31,'ER nurse','shot','veil',{pun:.3,absurd:.7,selfDeprecating:1,observational:.8,cheesy:.1},{skin:'#e4b08c',hair:'#7a3b1e',style:'bun',shirt:'#e0567c'},'I have seen things in triage and that still got me.'),
 person('maeve','Maeve','woman',27,'pastry chef','honeyOld','veil',{pun:1,absurd:.6,selfDeprecating:.5,observational:.5,cheesy:.7},{skin:'#f1c9a8',hair:'#c9622f',style:'curly',shirt:'#6fb7a8'},'That joke rose. Like a good brioche.'),
 person('marcus','Marcus','man',33,'electrician','lager','softball',{pun:.9,absurd:.5,selfDeprecating:.7,observational:.5,cheesy:.8},{skin:'#6b4228',hair:'#17110e',style:'beard',shirt:'#3f6fb5'},'Shocking. And I say that professionally.'),
 person('tobias','Tobias','man',28,'grad student','lager','softball',{pun:.6,absurd:1,selfDeprecating:.9,observational:.7,cheesy:.2},{skin:'#efc8a6',hair:'#d8b45a',style:'short',shirt:'#3f6fb5'},'I am citing that in my thesis.'),
 person('ray','Ray','man',38,'bus driver','honeyOld','softball',{pun:1,absurd:.4,selfDeprecating:.6,observational:.9,cheesy:.9},{skin:'#c98f63',hair:'#57534e',style:'bald',shirt:'#3f6fb5'},'Next stop: that joke. I am getting off here.'),
 person('lena','Lena','woman',35,'auditor','paloma','office',{pun:.4,absurd:.5,selfDeprecating:.7,observational:1,cheesy:.2},{skin:'#f0ceb4',hair:'#2d2a26',style:'bob',shirt:'#8c6bb1'},'I found no errors in that joke. Rare.'),
 person('omar','Omar','man',30,'data analyst','espresso','office',{pun:.7,absurd:.8,selfDeprecating:.5,observational:.9,cheesy:.4},{skin:'#b57d54',hair:'#120e0c',style:'short',shirt:'#d3a13b'},'That was three standard deviations funnier than expected.'),
 person('jules','Jules','woman',26,'UX writer','espresso','office',{pun:.8,absurd:1,selfDeprecating:.9,observational:.6,cheesy:.5},{skin:'#7d4f31',hair:'#111111',style:'curly',shirt:'#e88f4a'},'Clear, concise, and I hate how much I laughed.'),
 person('nico','Nico','man',34,'jazz trumpeter','honeyOld',null,{pun:.5,absurd:1,selfDeprecating:.8,observational:.7,cheesy:.3},{skin:'#d9a57c',hair:'#2a1a12',style:'beard',shirt:'#2f8f83'},'That had timing. You cannot teach timing.'),
 person('sofia','Sofia','woman',32,'marine biologist','paloma',null,{pun:.9,absurd:.9,selfDeprecating:.4,observational:.8,cheesy:.5},{skin:'#d6a077',hair:'#3a2415',style:'long',shirt:'#3b9ad0'},'Even the octopus I study would have laughed. She is very judgmental.')
];
export const SUGGESTED_LINES=[
 'I came here to forget my landlord, but he keeps texting me about the raccoon.',
 'Are you a loan? Because you have my interest, and I also cannot afford you.',
 'I would buy you a drink, but my bank just asked me to bear with them.',
 'Have you noticed the jukebox only plays songs from one extremely sad decade?',
 'My therapist says I should open up more, so here: I once lost a fight to a revolving door.',
 'I am legally required to tell you I am a goose in a trench coat.',
 'This bar is so dim I just apologized to a coat rack and got its number.',
 'Did it hurt? When you fell from heaven? Asking for my insurance adjuster.',
 'I have a great personality, and by that I mean a tiny wizard lives in my phone and does my texts.',
 'Everyone here looks like they have a podcast, and I am terrified.',
 'I am unbearable, but this honey beer is making me seem almost tolerable.',
 'My mom says I am a catch, but she also says that about the haunted lamp she bought.',
 'The bartender is a literal bear and still the best listener I have met all year.',
 'I am bad at flirting, so please imagine I said something charming and then left.',
 'Why does the bathroom here have better lighting and more self-esteem than I do?',
 'I do not usually do this. I usually stay home and argue with a pigeon on my windowsill.'
];
const STYLE_PATTERNS={
 cheesy:/\b(heaven|angels?|fell from|are you a|map|tired|running through|parking ticket|wi-?fi|loan|lose my number|dictionary|come here often|catch)\b/,
 pun:/\b(bear with|unbearable|beary|pawsitive|hoppy|gin-?uine|ale|honey|bee|mead|pint|whisky|whiskey|tequila|shot|lager|paloma|pun)\b/,
 selfDeprecating:/\b(i|i'm|im|my)\b.*\b(terrible|awful|worst|failed|mom|mother|landlord|therapist|divorced|single|embarrass\w*|sad|broke|bad at|ex|unemployed|cry|cried|lost|personality)\b/,
 absurd:/\b(raccoons?|goose|geese|wizards?|ghosts?|pirates?|dinosaurs?|aliens?|lobsters?|potato(es)?|haunted|vampires?|possums?|pigeons?|cult|sword|time travel|trench coat|coat rack|tiny)\b/,
 observational:/\b(this (bar|place)|jukebox|bartender|everyone here|why do(es)?|have you noticed|karaoke|the bathroom|the lighting|that (song|guy)|podcast)\b/
};
const CREEPY=/\b(your (body|tits|boobs|ass|butt|rack|legs)|nudes?|naked|in bed|sleep with (me|you)|hook ?up|send pics|blow ?job|fuck (me|you)|my (dick|cock)|underage|teenagers?|get you drunk|drunk enough|no means|won'?t take no|shut up and|smile more|not like other girls|sluts?|whores?|bitch(es)?|sexy|bang you)\b/;
const hash=text=>{let value=2166136261;for(const char of String(text)){value^=char.codePointAt(0);value=Math.imul(value,16777619);}return value>>>0;};
const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
const pick=(rows,key)=>rows[hash(key)%rows.length];
export const cleanLine=text=>String(text??'').replace(/\s+/g,' ').trim().slice(0,MAX_LINE_LENGTH);
export const normalizeLine=text=>cleanLine(text).toLowerCase().replace(/[^\p{L}\p{N} ]/gu,'');
export const patronById=id=>PATRONS.find(row=>row.id===id);
export const patronsInGroup=groupId=>PATRONS.filter(row=>row.groupId===groupId);
export const drinkById=id=>DRINKS.find(row=>row.id===id);
export function clockLabel(minute){const hours=Math.floor(minute/60)%24,display=hours%12||12;return display+':'+String(minute%60).padStart(2,'0')+(hours<12?' AM':' PM');}
export function playerSway(tipsy){return tipsy===0?0:tipsy<=2?1:tipsy===3?0:tipsy-3<=1?-1:-3;}
export function createBarState({name='You'}={}){
 return{version:1,name:cleanLine(name).slice(0,24)||'You',minute:BAR_OPEN_MINUTE,cash:STARTING_CASH,tipsy:0,strikes:0,lines:[],log:[{id:1,kind:'system',text:'You push through the door of The Honey Pot. It smells like citrus and ambition.'}],nextLog:2,over:false,ending:null,leftWith:null,patrons:Object.fromEntries(PATRONS.map(row=>[row.id,{vibe:row.groupId?30:35,drinks:0,cold:false,number:false,gossip:false}]))};
}
function note(state,kind,text,extra={}){state.log.push({id:state.nextLog++,kind,text,...extra});if(state.log.length>80)state.log.shift();}
function spend(state,minutes){state.minute=Math.min(BAR_CLOSE_MINUTE,state.minute+minutes);if(state.minute>=BAR_CLOSE_MINUTE&&!state.over)endNight(state,'closing');}
const refuse=reason=>({ok:false,reason});
const talkable=(state,id)=>!!patronById(id)&&!state.patrons[id].cold;
/** Local house judge: used whenever the optional AI judge is unavailable. */
export function judgeLine(text,patron,{usedLines=[],tipsy=0}={}){
 const line=cleanLine(text),lower=line.toLowerCase(),words=line.split(' ').filter(Boolean).length;
 if(CREEPY.test(lower))return{id:patron.id,score:0,style:'creepy',creepy:true};
 if(usedLines.includes(normalizeLine(line)))return{id:patron.id,score:clamp(2+playerSway(tipsy),0,3),style:'repeat',creepy:false};
 if(words<3)return{id:patron.id,score:clamp(1+playerSway(tipsy),0,3),style:'flat',creepy:false};
 const known=new RegExp('\\b('+patron.name+'|'+patron.job.split(' ').join('|')+')\\b','i').test(line);
 const hits=HUMOR_STYLES.filter(style=>STYLE_PATTERNS[style].test(lower)||(style==='observational'&&known));
 const best=hits.length?Math.max(...hits.map(style=>patron.humor[style])):0;
 const style=hits.sort((a,b)=>patron.humor[b]-patron.humor[a])[0]??'flat';
 const shape=(words>=6&&words<=30?1:0)-(words>45?1:0)+(hits.length>1?.5:0)+(/[?!]$/.test(line)?.25:0);
 const luck=(hash(patron.id+lower)%5-2)/2;
 return{id:patron.id,score:Math.round(clamp(2.5+best*5+shape+luck+playerSway(tipsy),0,10)),style,creepy:false};
}
const REPLIES={
 creepy:['{name} stares at you until you feel your soul apologize.','"Wow. No." {name} turns back around.','{name} waves the bartender over. That is never a good sign.'],
 repeat:['"You said that already." {name} looks concerned for you.','{name} mouths the punchline along with you. It is not a compliment.'],
 flop:['{name} gives the kind of nod usually reserved for parking tickets.','"Ha," says {name}, as a word, not as a laugh.','A silence falls. {name} takes a long, protective sip.','{name} checks a phone that did not buzz.'],
 polite:['{name} smiles with exactly half their face.','"Okay, that was kind of cute," says {name}.','{name} exhales through the nose. In this bar, that is progress.'],
 laugh:['{name} laughs and has to put the drink down.','"Okay, who are you?" {name} is leaning in now.','{name} snorts, then looks furious about snorting.'],
 howl:['{signature}','{name} slaps the table. {signature}']
};
const tierFor=({score,creepy,style})=>creepy?'creepy':style==='repeat'?'repeat':score<=3?'flop':score<=5?'polite':score<=7?'laugh':'howl';
export function replyFor(judgement,patron,text){return pick(REPLIES[tierFor(judgement)],patron.id+text).replaceAll('{name}',patron.name).replaceAll('{signature}',patron.signature);}
/** Applies one line to a person or a whole group. Judgements may come from the AI judge or judgeLine. */
export function sayLine(state,{targetIds=[],text,judgements=null,source='house'}={}){
 if(state.over)return refuse('The night is over.');
 const line=cleanLine(text),ids=[...new Set(targetIds)].filter(id=>talkable(state,id));
 if(!line)return refuse('Say something first.');
 if(!ids.length)return refuse('Nobody here wants to hear that.');
 const results=ids.map(id=>{const patron=patronById(id),given=judgements?.find(row=>row.id===id);const judgement=given??judgeLine(line,patron,{usedLines:state.lines,tipsy:state.tipsy});return{...judgement,id,reply:cleanLine(given?.reply)||replyFor(judgement,patron,line)};});
 const groupTalk=ids.length>1,laughs=results.filter(row=>row.score>=6).length,contagion=groupTalk&&laughs*2>=ids.length?4:0,creepy=results.some(row=>row.creepy);
 note(state,'player',line,{audience:groupTalk?(PATRONS.find(row=>row.id===ids[0]).groupId?GROUPS.find(row=>row.id===patronById(ids[0]).groupId).label:'the group'):patronById(ids[0]).name});
 for(const row of results){const seat=state.patrons[row.id];row.delta=creepy?-30:Math.round((row.score-4)*(groupTalk?3:4))+contagion;seat.vibe=clamp(seat.vibe+row.delta,0,100);if(seat.vibe<=8||creepy&&seat.vibe<=15)seat.cold=true;note(state,'patron',row.reply,{patronId:row.id,delta:row.delta,cold:seat.cold});}
 if(contagion)note(state,'system','The laugh spreads around the table. The whole group warms up.');
 state.lines.push(normalizeLine(line));
 if(creepy){state.strikes++;note(state,'bouncer',state.strikes>=MAX_STRIKES?'Barnaby the bartender points one enormous paw at the door.':'Barnaby leans over the bar: "Keep it friendly, or you are out. Strike '+state.strikes+' of '+MAX_STRIKES+'."');if(state.strikes>=MAX_STRIKES){endNight(state,'bounced');return{ok:true,results,source};}}
 spend(state,groupTalk?12:10);
 return{ok:true,results,source};
}
/** Empty forIds means the drink is for the player; several ids buy a round. */
export function buyDrink(state,{drinkId,forIds=[]}={}){
 if(state.over)return refuse('The night is over.');
 const drink=drinkById(drinkId),ids=[...new Set(forIds)];
 if(!drink)return refuse('Barnaby has never heard of that.');
 if(ids.some(id=>!patronById(id)))return refuse('That person is not here.');
 if(!ids.length){
  if(drink.alcohol&&state.tipsy>=PLAYER_CUTOFF)return refuse('Barnaby slides you a water instead. You are cut off.');
  if(drink.price>state.cash)return refuse('Your card makes a small, sad sound.');
  state.cash-=drink.price;state.tipsy=drink.alcohol?state.tipsy+1:Math.max(0,state.tipsy-1);
  note(state,'system',drink.alcohol?'You order a '+drink.label+'. '+(state.tipsy<=2?'Your confidence rises.':state.tipsy<=3?'You are at the perfect wobble.':'The floor is becoming a suggestion.'):'You sip a '+drink.label+'. The room steadies.');
  spend(state,5);return{ok:true,cost:drink.price};
 }
 const open=ids.filter(id=>!state.patrons[id].cold),taking=open.filter(id=>!drink.alcohol||state.patrons[id].drinks<PATRON_DRINK_LIMIT),cost=drink.price*taking.length;
 if(!open.length)return refuse('They send it back. They are done with you tonight.');
 if(!taking.length)return refuse(patronById(open[0]).name+' has had enough. Try the soda or water.');
 if(cost>state.cash)return refuse('That costs $'+cost+'. You have $'+state.cash+'.');
 state.cash-=cost;
 const results=[];
 for(const id of taking){const patron=patronById(id),seat=state.patrons[id],favorite=patron.drink===drink.id,caring=!drink.alcohol&&seat.drinks>=2,delta=favorite?16:caring?10:drink.id==='water'?1:7;seat.vibe=clamp(seat.vibe+delta,0,100);if(drink.alcohol)seat.drinks++;results.push({id,delta,favorite});note(state,'patron',favorite?'"How did you know that is my drink?" '+patron.name+' lifts the glass your way.':caring?patron.name+' looks genuinely grateful for the '+drink.label+'.':patron.name+' accepts the '+drink.label+' with a nod.',{patronId:id,delta});}
 if(taking.length<open.length)note(state,'system','Barnaby quietly skips anyone who has had enough.');
 if(taking.length>1)note(state,'system','You bought a round for $'+cost+'. Your wallet weeps; the table cheers.');
 spend(state,taking.length>1?8:5);return{ok:true,cost,results};
}
export function buyGossip(state,id){
 if(state.over)return refuse('The night is over.');
 const patron=patronById(id);if(!patron)return refuse('That person is not here.');
 if(state.patrons[id].gossip)return{ok:true,cost:0};
 if(state.cash<GOSSIP_PRICE)return refuse('Barnaby only gossips for tips.');
 state.cash-=GOSSIP_PRICE;state.patrons[id].gossip=true;
 const favorite=HUMOR_STYLES.reduce((best,style)=>patron.humor[style]>patron.humor[best]?style:best,HUMOR_STYLES[0]);
 note(state,'system','Barnaby, polishing a glass: "'+patron.name+' drinks '+drinkById(patron.drink).label+' and likes '+({pun:'puns',absurd:'absurd nonsense',selfDeprecating:'people who roast themselves',observational:'sharp observations',cheesy:'gloriously cheesy lines'})[favorite]+'."'+(patron.taken?' "Also, the veil is not a costume."':''));
 spend(state,3);return{ok:true,cost:GOSSIP_PRICE};
}
export function askAvailability(state,id){
 const patron=patronById(id),seat=state.patrons[id];
 if(seat.number)return{status:'number'};
 if(seat.cold)return{status:'cold'};
 if(patron.taken)return{status:'taken'};
 if(seat.drinks>=PATRON_DRINK_LIMIT)return{status:'tipsy'};
 if(state.tipsy>=PLAYER_CUTOFF)return{status:'playerTipsy'};
 return{status:seat.vibe>=NUMBER_VIBE?'yes':'notYet'};
}
/** A yes needs earned vibe. Nobody too tipsy can say yes, and a no costs the player vibe. */
export function shootShot(state,id){
 if(state.over)return refuse('The night is over.');
 const patron=patronById(id);if(!patron)return refuse('That person is not here.');
 const seat=state.patrons[id],{status}=askAvailability(state,id);
 if(status==='cold')return refuse(patron.name+' is done talking to you tonight.');
 if(status==='number')return{ok:true,status,canLeave:seat.vibe>=LEAVE_VIBE};
 if(status==='taken'){seat.vibe=clamp(seat.vibe-5,0,100);note(state,'patron','"I am literally wearing a veil." '+patron.name+' points at the veil.',{patronId:id,delta:-5});spend(state,5);return{ok:true,status};}
 if(status==='tipsy'){note(state,'system','Barnaby shakes his head: "'+patron.name+' has had plenty. Ask them when they are sober. Get them a water."');return{ok:true,status};}
 if(status==='playerTipsy'){note(state,'system','You attempt charm. Your mouth attempts soup. Maybe drink some water first.');return{ok:true,status};}
 if(status==='notYet'){seat.vibe=clamp(seat.vibe-10,0,100);note(state,'patron',patron.name+' laughs kindly. "Bold! But no. You have not earned that yet."',{patronId:id,delta:-10});spend(state,5);return{ok:true,status};}
 seat.number=true;note(state,'win',patron.name+' takes your phone and types in a number under "'+patron.signature.split(/[.,:]/)[0].slice(0,28)+'".',{patronId:id});
 spend(state,5);return{ok:true,status:'yes',canLeave:seat.vibe>=LEAVE_VIBE};
}
export function leaveWith(state,id){
 if(state.over)return refuse('The night is over.');
 const patron=patronById(id);if(!patron)return refuse('That person is not here.');
 const seat=state.patrons[id];
 if(!seat.number||seat.vibe<LEAVE_VIBE||seat.drinks>=PATRON_DRINK_LIMIT)return refuse(patron.name+' is not ready to leave with you.');
 state.leftWith=id;endNight(state,'together');return{ok:true};
}
export function endNight(state,ending='home'){if(state.over)return state;state.over=true;state.ending=ending;return state;}
export function nightScore(state){
 const numbers=PATRONS.filter(row=>state.patrons[row.id].number),friends=PATRONS.filter(row=>state.patrons[row.id].vibe>=60&&!state.patrons[row.id].number).length,points=numbers.length*100+friends*25+(state.leftWith?150:0)+state.cash-state.strikes*75;
 const title=state.ending==='bounced'?'Escorted Out By A Bear':state.leftWith?'Closing Time Legend':numbers.length>=3?'Certified Menace':numbers.length?'Smooth Operator':friends>=3?'Everybody’s Pal':'Regular At Table Zero';
 return{numbers:numbers.map(row=>row.name),friends,points:Math.max(0,points),title};
}
