import { EXPERIENCES } from '../../world/universe/registry.js';

// Media URLs are static assets, never the registry's live iframe `preview` URL.
export const MANIFEST_VERSION = 'demo-previews.1';
export const MEDIA = Object.freeze({
  'future-machine': { image: '/data/launch/two-futures.png', video: '/demo-gallery/media/future-machine.mp4' },
});
// Optional dated captures retain previous previews without duplicating cards.
export const ARCHIVED_PREVIEWS = Object.freeze([]);
const visualizations = [
  ['grid', 'Port Calder grid', '/visualizations/'],
  ['kerpow', 'Kerpow', '/visualizations/kerpow.html'],
  ['painting-outside-frame', 'Painting outside the frame', '/visualizations/painting-outside-frame.html'],
  ['rainbow-brain', 'Rainbow brain', '/visualizations/rainbow-brain.html'],
  ['voting-particles', 'Voting particles', '/visualizations/voting-particles.html'],
].map(([id, title, route]) => ({ id: `visualization-${id}`, title, route, group: 'visualizations', description: 'Interactive visualization.' }));
export function buildCatalog(experiences = EXPERIENCES, media = MEDIA) {
  return [
    { id: 'homepage', title: 'Homepage previews', route: '/', group: 'home', description: 'Current share image and video. Unavailable until published locally.', image: '/preview.jpg', video: '/preview.mp4' },
    ...experiences.map(item => ({ ...item, group: item.route.startsWith('/tools/') ? 'tools' : 'worlds', ...media[item.id] })),
    ...visualizations,
    ...ARCHIVED_PREVIEWS,
  ];
}
export function filterCatalog(catalog, group, query = '') {
  const search = query.trim().toLowerCase();
  return catalog.filter(item => (group === 'all' || item.group === group) && `${item.title} ${item.description} ${item.route}`.toLowerCase().includes(search));
}
