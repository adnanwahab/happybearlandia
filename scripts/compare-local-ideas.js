import { compareLocalIdea } from '../world/civilization/ideas/local.js';

// Bounded reproducible synthetic neighborhood. JSON retains the complete recipe and hop evidence.
const residents = Array.from({ length: 25 }, (_, i) => ({ id: `resident-${i}`, x: (i % 5) * 8, y: Math.floor(i / 5) * 8 }));
console.log(JSON.stringify(compareLocalIdea({ residents, originId: 'resident-0', seed: 42, ticks: 12, radius: 8 }), null, 2));
