export function encodeChallenge(recipe) {
  return [recipe.version, recipe.seed, recipe.amount, recipe.index].join(':');
}

export function decodeChallenge(encoded, { version, samples, options }) {
  if (typeof encoded !== 'string' || encoded.length > 80) throw new Error('Invalid challenge link.');
  const [sourceVersion, seedText, amountText, indexText, ...extra] = encoded.split(':');
  if (sourceVersion !== version) throw new Error('This challenge uses an unavailable model version.');
  if (extra.length || !/^[0-9]{1,10}$/.test(seedText) || !/^[0-9]{1,3}$/.test(indexText)) {
    throw new Error('Invalid challenge link.');
  }
  const seed = Number(seedText);
  const amount = Number(amountText);
  const index = Number(indexText);
  if (seed > 4294967295 || !options.some(option => String(option.amount) === amountText) ||
      index >= samples) throw new Error('The challenge contains an unsupported input.');
  return { version: sourceVersion, seed, amount, index };
}
