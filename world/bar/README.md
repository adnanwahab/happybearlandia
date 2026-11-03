# The Social Bear — `/world/bar`

A self-contained social bar scene for HappyBearLandia. Open `/world/bar` or
`/world/bar/`, choose an adult guest or a table, and play a night of conversation.
The House Simulator has a **Bar night** link that opens a separate tab and keeps
the original household URL available as the return destination.

## Playing

- Meet six fictional adults: Nova, Maya, Ivy, Theo, Jax, and Owen.
- Read their visible humor clues and choose from three personal conversation
  rounds. Each guest has 12 authored choices and individual responses.
- Join three groups, each with two rounds and different reactions from both
  listeners. You can then talk privately to either person.
- Order water, soda, a mocktail, beer, wine, or a cocktail for yourself; offer
  a drink to a guest; or offer a round to a table. The evening starts with $60
  of fictional spending money. Preferences determine who accepts, and only
  accepted drinks are charged. A group order that exceeds the budget is
  rejected in full. Each guest gets one drink offer per evening.
- Build rapport through conversation, recover from a missed joke once, and
  ask to exchange numbers or plan a date. Invitations can produce a connection,
  a friendly outcome, or a goodbye. An answer settles that attempt for the night.
- Enjoy three optional bar events, inspect saved connections, and end the
  evening with a recap. A new night resets spending and conversations while
  retaining unique connections.
- Use the guest and group buttons or click people/tables in the room. Keys
  **1–4** select dialogue choices; **Escape** returns to the room. Sound is
  optional and starts only when selected.

## Integration boundary

This is an independent bar mode. Its save key is `happybearlandia:bar:v1` in
browser localStorage. Its cast, budget, contacts, and date-plan cards belong to
this mode; they do not alter household finances, city NPCs, or the existing
date/relationship/family simulation. A planned date is currently a saved story
card, not a launch into the `/world/date` system. This keeps existing city saves
and the active household date authority intact.

`returnTo` accepts only a relative `/world/house` route and its query string.
External URLs and unrelated paths fall back to `/world/house`. The mode does not
call external AI APIs or require credentials, additional packages, or a server
database. The room reuses HappyBearLandia's existing Three.js vendor route.

Drink orders do not increase chemistry or change anyone's willingness to date.
There is no intoxication state. Dialogue outcomes are deterministic and authored;
the interface offers choices rather than a free-text chatbot.

## Files

| File | Responsibility |
| --- | --- |
| `index.html`, `bar.css`, `app.js` | Responsive interface, accessible controls, persistence, audio and scene wiring |
| `content.js` | Cast, 72 individual choices, 24 group choices, drink menu, and events |
| `model.js` | Pure immutable state transitions, validated save restoration, budget and invitation rules |
| `scene.js` | Procedural 3D bar, characters, selection and reaction animations |
| `software-renderer.js` | Canvas rendering of the same room when WebGL is unavailable |
| `audio.js` | Optional original synthesized lounge loop |
| `model.test.mjs` | Gameplay and save-restoration regression tests |

The route is registered before the general `/world` static handler in `server.js`.
`routes.html` also links to the bar.

## Verification

```sh
node --test world/bar/model.test.mjs
bun run server.js
```

Visit `/world/bar`, buy something for yourself, offer a round, complete a group
conversation, and finish an individual conversation. Check the wallet and
connections after reloading. Test both accepted and declined offers. The UI
continues to support the full game if the 3D renderer is unavailable, and respects
reduced motion preferences.

The implementation was built against `main` commit
`3f7c5de1bbc9efe1b7a7210ea5454dd075fc5e8d`.
