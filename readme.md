# Peoplebox - HappyBearHouse
- [ ] local AI setup ?

# Grattitude game
# HappyBearLandia - VR/AR Game Studio for Education

![map](map.png)

# write journal -> synthesize plan -> simulate 100 realities from that plan 



# Computer Vision for Beginners

# simulate so much data can visualize long term trends

# explore many futures from simulator

# Simulator visualizes list of proposals from dear-congress.fly.dev
# simulator helps system
https://mixkit.co/free-sound-effects/funny/

Imagine clicking anywhere in your Replay Analyzer
Your /replay-analyzer/:scene_id could eventually have a timeline like:
00:00 ━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━ 00:30
               ↑
             12.4s

You pause at 12.4s.

Instead of only:

Play / Pause / Rewind

you could have:
FORK WORLD

Click it.

The simulator reconstructs:
Bear:
 position = [3.1, 0, -4.2]
 velocity = [0.4, 0, 0.1]

Ball:
 position = [...]
 velocity = [...]

Domino #1:
 rotation = [...]

Cart:
 sleeping = true

Door:
 closed

NPC #4:
 walking toward bar

That becomes a checkpoint.

Then you modify something.
ball.mass = 3kg → 5kg

and hit:
RUN 100 FUTURES

Now you get:
Original
    │
    ├── mass 3.0 → success
    ├── mass 3.2 → success
    ├── mass 3.4 → success
    ├── mass 3.6 → success
    ├── mass 3.8 → collision
    ├── mass 4.0 → collision
    └── mass 5.0 → cart knocked over

That would be extremely useful for game development.

The world becomes a tree
Instead of thinking of your replay system as:
PAST ───────────────→ FUTURE

think:
                         state S₀
                            │
                         action A
                            │
                         state S₁
                            │
             ┌──────────────┼──────────────┐
             │              │              │
           action B       action C       action D
             │              │              │
            S₂             S₃             S₄
          / | \           / | \           / \
         ↓  ↓  ↓         ↓  ↓  ↓         ↓   ↓

Now HappyBearLandia isn't merely recording what happened.

It's exploring a possibility tree.

That concept shows up in many fields under different names:

rollouts, counterfactual simulation, Monte Carlo simulation, trajectory branching, planning, world models, and scenario generation.

They are all closely related.


This is counterfactual simulation
You're asking:
“What would have happened if something had been different?”

For example:
Observed reality
───────────────
Bear pushes ball at 4.2 m/s
→ puzzle succeeds

Now branch it:
What if velocity = 3.0?
What if velocity = 3.1?
What if velocity = 3.2?
...
What if velocity = 7.0?

Suddenly you can discover something like:
velocity

2 ─────────── FAIL
3 ─────────── FAIL
4 ─────────── SUCCESS
5 ─────────── SUCCESS
6 ─────────── SUCCESS
7 ─────────── CHAOTIC FAILURE
8 ─────────── CHAOTIC FAILURE

That's much more informative than knowing that one run succeeded.

You've discovered the space of possible outcomes.

                    START
                      │
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
    push box       pick apple     move chair
        │             │             │
        ↓             ↓             ↓
      fail          maybe          maybe
                      │
                ┌─────┴─────┐
                ↓           ↓
             throw       walk over
                │           │
               fail       SUCCESS

                         HAPPYBEARLANDIA

                              Scene
                                │
                                ▼
                         Initial State S₀
                                │
                                ▼
                         ┌── Simulator ──┐
                         │               │
                  Physics             Agents
                         │               │
                         └──────┬────────┘
                                │
                                ▼
                             Events
                                │
                                ▼
                          State History
                                │
                   ┌────────────┴────────────┐
                   ▼                         ▼
                Replay                     Fork
                                              │
                                   ┌──────────┼──────────┐
                                   ▼          ▼          ▼
                                Future 1   Future 2   Future 3
                                   │          │          │
                                   └──────────┼──────────┘
                                              ▼
                                         Evaluator
                                              │
                                              ▼
                                      Outcome Landscape


                                                               ☀ MAGNIFYING GLASS
                                                                     │
                                                                     ▼
                                                                burns string
                                                                     │
                                                                     ▼
                                                              🎈 balloon rises
                                                                     │
                                                          pulls rope over pulley
                                                                     │
                                                                     ▼
                                             marble track ◀──── RELEASES MARBLE
                                                  │
                                                  ▼
                                             ╭─────────╮
                                             │ spirals │
                                             ╰────┬────╯
                                                  ▼
                                             DOMINO FIELD
                                           ▯ ▯ ▯ ▯ ▯ ▯ ▯
                                                      │
                                                      ▼
                                                    hammer
                                                      │
                                                      ▼
                                                 🔔 rings bell
                                                      │
                                                      ▼
                                              startled toy bird
                                                      │
                                                      ▼
                                                knocks ball
                                                      │
                                                      ▼
                                           ball rolls through giant
                                                  CLOCKWORK
                                                ⚙️ ⚙️ ⚙️ ⚙️
                                                      │
                                                      ▼
                                                lifts elevator
                                                      │
                                                      ▼
                                                toy train departs
                                       🚂━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                                │
                                                                ▼
                                                         train hits lever
                                                                │
                                                                ▼
                                                          bucket tips
                                                                │
                                                           water falls
                                                                ▼
                                                         WATER WHEEL
                                                          ≋≋≋ ⚙ ≋≋≋
                                                                │
                                                                ▼
                                                       generator spins
                                                                │
                                                                ▼
                                                          💡 light turns on
                                                                │
                                                                ▼
                                                      solar sensor detects it
                                                                │
                                                                ▼
                                                          servo releases
                                                             bowling ball
                                                                │
                                                                ▼
                                                           🎳
                                                      enormous ramp
                                                                │
                                                                ▼
                                                         launches seesaw
                                                          ╱────────╲
                                                        🐻          ●
                                                                │
                                                                ▼
                                                         glove punches
                                                           toaster
                                                                │
                                                                ▼
                                                          toast launches
                                                                │
                                                                ▼
                                                       toast hits cymbal
                                                            💥
                                                                │
                                                                ▼
                                                    vibration releases spoon
                                                                │
                                                                ▼
                                                       spoon falls into cup
                                                                │
                                                                ▼
                                                          kettle tilts
                                                               ☕
                                                                │
                                                                ▼
                                      
                                                          ONE CUP OF TEA

simulators, games, tools, robots

this repo has a physics puzzle game that makes data for machine learning

# Usage instructions

how to run application locally

\`bun run dev\`

how to run augmented reality locally

op run --env-file=.env.op -- bun scripts/fs-sync-mediapipe.ts

## /game
## /edit (Augmented_reality)
## /pick-and-place multiplayer_robots
## /inference
## /training
## /data


# hardware 
https://www.hiwonder.com/products/nexarm6-axis

- 5 minutes stream per day
fswebcam -r 1920x1080 --no-banner image.jpg
ffmpeg -f v4l2 -framerate 30 -video_size 1920x1080 \
-i /dev/video0 \
-t 5 \
-c:v libx264 \
-preset veryfast \
output.mp4
HappyBearLandia/
  webcam/
    2026-09-11/
      00-00.mp4

# how to run locally
bun run start

## World map `.env` setup (recommended)

Bun auto-loads `.env` from the project root, so you can configure world map connectivity once:

1. Copy the template:
   `cp .env.example .env`
2. Edit `.env` and set a reachable Overpass endpoint:
   - `OVERPASS_URL=https://<reachable-host>/api/interpreter`
   - `OVERPASS_TIMEOUT_MS=15000`
3. Start server:
   `bun server.js`
4. Validate connectivity:
   - `/api/config` shows active runtime config (safe fields only)
   - `/api/overpass-health` should show `reachable: 1+`
   - `/api/area?lat=40.7265&lng=-73.9815` should return `"source":"osm"` when reachable

# how to deploy

fly deploy

# references
- https://www.youtube.com/watch?v=4Tr0otuiQuU&list=RD4Tr0otuiQuU&start_radio=1
- https://github.com/jhuckaby/canvascycle
