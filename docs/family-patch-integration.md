# Uploaded family patch integration

The five uploaded patches target commit `6722f7d274fc7c2d6b002835c0b411ba068a01cf`. They apply to that reference but conflict with the current household implementation. Their compatible missing behaviors were merged into the existing systems rather than replacing current saves or actual population agents.

| Patch | Integration |
| --- | --- |
| 0001 Commitment states | Existing canonical relationship ties retain dating, engagement, marriage, separation, divorce, consent and completion milestones. |
| 0002 Proposal and wedding | Added relationship-profile shortcuts using current canonical eligibility and two independent consent checks. Commitment changes after actual attended events. |
| 0003 Partner move-in | Added profile shortcut into the existing roommate agreement, with zero rent/deposit defaults, both consents, actual bed/capacity checks and unchanged person/financial-household identity. |
| 0004 Family system | Explicit options in Family planning can start a timed discussion. Successful completion creates exactly one canonical family plan, with existing real-agent birth/adoption and checkpoint support. No shadow dependent registry is installed. |
| 0005 Baby care | Current feeding, changing, rocking, reading, play and nursery furniture remain. Added elapsed soothing care with visible caregiver presentation. Existing adult caregiver rules and furniture fallbacks remain compatible with saved homes. |

The original shadow-child schema shares a version name with the newer actual-agent family state and cannot safely replace it. No attachment shell scripts were executed. Changes stay within HappyBearLandia; no separate protocol project was created.

Validation includes canonical model tests, interrupted/replayed family discussions, actual attended care, and browser proposal/marriage/move-in/save/reload workflows. Separate regressions cover automatic SQLite saves, queue auto-resume and immediate invitations.
