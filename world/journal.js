function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(list, seed, salt = "") {
  if (!Array.isArray(list) || list.length === 0) return "";
  const i = hash32(`${seed}|${salt}`) % list.length;
  return list[i];
}

function floodedHome(person, ctx) {
  const byId = ctx?.buildingsById || {};
  const home = byId[person?.home] || byId[String(person?.home)] || null;
  return !!home?.state?.flooded;
}

function transitBurdened(person) {
  const avg = Number(person?.walkMinutesAvg3d || 0);
  const top20 = !!person?.today?.highWalk;
  return avg > 60 || top20;
}

function floodSentence(seed) {
  return pick([
    "Our street flooded in the storm and the drainage couldn't keep up.",
    "Flood water reached our home area again, and the drainage failed us.",
    "After the storm, we saw flood water around us and weak drainage made it worse.",
  ], seed, "flood");
}

function transitSentence(seed) {
  return pick([
    "My commute keeps getting longer and I lose too much time each day.",
    "The bus trip for my commute takes too long and throws off my day.",
    "I need a shorter commute because the bus connection is too slow.",
  ], seed, "transit");
}

function streetsSentence(seed) {
  return pick([
    "I reported the trashed park to 311 again and it still needs attention.",
    "After repeated dirty park visits, I called 311 again for cleanup.",
    "I had to use 311 again because the park stayed filthy.",
  ], seed, "streets");
}

function groceriesSentence(person, seed) {
  const sold = Array.isArray(person?.today?.soldOutAt) ? person.today.soldOutAt.filter(Boolean) : [];
  if (sold.length > 0) {
    const place = sold[hash32(`${seed}|soldout-place`) % sold.length];
    return pick([
      `I went to ${place} and basic groceries were sold out when I got there.`,
      `${place} had empty shelves when I arrived for groceries.`,
      `At ${place}, the shelves were empty again when I tried to buy groceries.`,
    ], seed, "groceries-soldout");
  }

  if (person?.today?.emptyFridge) {
    return pick([
      "Our fridge was empty tonight and it was hard to find groceries nearby.",
      "I came home to an empty fridge and struggled to get basic groceries.",
      "We ran out at home and finding groceries nearby was difficult.",
    ], seed, "groceries-fridge");
  }

  return "";
}

export function journalFor(person, ctx) {
  if (!person || !person.today) return null;

  const day = Number(person.today.day || 0);
  const seed = `${person.id ?? "p"}-${day}`;

  const problems = [];
  const flood = !!person.today.displaced || !!person.today.homeFlooded || floodedHome(person, ctx);
  if (flood) problems.push({ id: "flood", score: 100 });

  if (transitBurdened(person)) problems.push({ id: "transit", score: Math.max(60, Number(person.walkMinutesAvg3d || 0)) });

  if (Number(person.today.dirtyParkVisits || 0) >= 2) {
    problems.push({ id: "streets", score: 70 + Number(person.today.dirtyParkVisits || 0) });
  }

  if ((person.today.soldOutAt && person.today.soldOutAt.length > 0) || person.today.emptyFridge) {
    problems.push({ id: "groceries", score: 75 + (person.today.soldOutAt?.length || 0) * 5 });
  }

  if (!problems.length) return null;

  problems.sort((a, b) => b.score - a.score);
  const top = problems.slice(0, 2);

  const out = [];
  for (const p of top) {
    if (p.id === "flood") out.push(floodSentence(seed));
    else if (p.id === "transit") out.push(transitSentence(seed));
    else if (p.id === "streets") out.push(streetsSentence(seed));
    else if (p.id === "groceries") {
      const s = groceriesSentence(person, seed);
      if (s) out.push(s);
    }
  }

  if (out.length < 2) {
    out.push(pick([
      "This keeps disrupting my daily life.",
      "I'm sharing this because it keeps happening.",
      "I need a practical fix soon.",
    ], seed, "closer"));
  }

  return out.slice(0, 4).join(" ");
}
