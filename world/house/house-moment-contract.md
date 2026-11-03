# Household moment UI integration

`mountHouseUI` optional callbacks:

- `onEvening({personId})`: open the canonical evening scenario controller. The Tonight button is disabled until connected. The UI does not advance time or create results itself.
- `onProfileCommand({personId,patch})`: persist bounded edits to the actual resident. Return `{accepted:true}` only after success; `{accepted:false,reason}` or rejection leaves the draft and displays the reason. Patch contains only changed fields: `name` (1–50 chars); `favoriteActivity`, `concern`, `aspiration` (0–120 chars); existing `shirtColor`, `skinColor`, `hairColor` (`#rrggbb`). Personal aspiration is a player-authored note, not a completed canonical social aspiration. Return these values in inspected person records (`person.profile` or direct fields) after saving. No browser-only profile store is used.
- `onCameraControl({type:'follow',personId})` / `({type:'home'})`: optional root camera handler. Without it, existing renderer `setCameraPreset('follow',{personId})` and `'dollhouse'` are used.

House UI moves existing `.story-mode-controls` into More and removes its duplicate Watch a day, retaining existing event handlers. Its observer disconnects on destroy. No story subsystem mutation is involved.

Immediate wants in mood detail use `data.story.members` first, matching the bottom story strip. `Now` uses the actual active action, while `Next` and `Afterward` use queued requests; urgent need suggestions are separate do-now requests with canonical availability checked on admission.

Date recap/media work is complete in `date-memory-ui.js` and `date-media-store.js`. Photo upload must follow an acknowledged current checkpoint save (the integration already provides `flush`). `openEnded` removes the scheduler horizon as a semantic end bound; saved clock/start, finite legacy deadlines, explicit `endedMinute`, exact date/pair/household and actual geographic destination proof remain enforced. Targeted SQLite reopen/end tests cover this. Later natural dialogue recall belongs to `retainedPartnerAnswer` in `date-cinematic-system.js`, not the scrapbook UI. Retrospective learned preferences need per-record evidence, since couple lifetime preferences cannot honestly be assigned to a particular past outing.
