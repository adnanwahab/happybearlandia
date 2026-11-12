import { mountUniverseNavigation } from './connected-navigation.js';
import { experienceFromLocation } from './html-navigation.js';

// One mount per document, including module reloads and query/hash navigation.
let experienceId;
function mount() {
  const experience = experienceFromLocation(window.location);
  if (experience?.id === experienceId) return;
  window.hblUniverseNavigation?.dispose();
  delete window.hblUniverseNavigation;
  experienceId = experience?.id;
  if (experience && document.body) {
    window.hblUniverseNavigation = mountUniverseNavigation(document.body, { experienceId });
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
window.addEventListener('popstate', mount);
window.addEventListener('hashchange', mount);
