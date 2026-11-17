# SHE-257: city-builder customer discovery

Protocol v1 · 2026-11-12 · preparation only. Completed interviews: **0/5**.
No recruitment method has been approved, no outreach has occurred in this task,
and no findings are available. This document contains prompts and blank templates,
not participant evidence.

Source: [SHE-257](https://linear.app/shel-bernstein/issue/SHE-257/hbl-res-five-customer-discovery-interviews-with-city-builder-players).
Consent follows SHE-52's opt-in and minimal-identifier requirements. This is
separate from SHE-29's first-minute playtest and SHE-68's launch experiment.
The product's [design](design.md) supplies hypotheses, not interview findings.

## Recruitment decision — pending human approval

Proposed method: a human moderator posts one invitation in a city-builder or
simulation-game community where research invitations are permitted, after any
required community-moderator permission. Invite volunteers who are adults and
have played a city-builder or simulation game in the past six months. Aim for
five distinct people with varied games and experience; record selection bias.
No scraping, unsolicited direct messages, or automated outreach is proposed.

Proposed invitation, for review only:

> We are learning how adults play city-builder and simulation games. We are
> looking for five volunteers for a 30-minute conversation about games you
> already use, questions you wish they could answer, and times you stopped
> playing. There is no sales pitch or pricing discussion. Participation and
> answering any question are optional. We take anonymous written notes, with
> your permission; there is no audio or video recording. Please reply only if
> you would like to hear more; do not post personal details publicly.

Before outreach, a human must fill in this decision record and approve the exact
channel and invitation. Approval of this document alone does not approve outreach.

- Human approver and approval date: pending
- Exact community/channel and permission evidence: pending
- Approved invitation/version and recruitment method: pending
- Human moderator and private scheduling method: pending
- Private notes location, authorized viewers, and deletion date: pending
- Recruitment approval reference: pending

Keep scheduling in the human's existing private channel; do not copy contact
details into research artifacts or retain a participant contact list. Do not
start interviews until the private notes location and deletion date are set.
The invitation and script must be updated together if these terms change.

## Consent script — read before taking substantive notes (0–3 minutes)

> Thank you for joining. This is a 30-minute conversation about your experience
> with city-builder or simulation games. We want to understand what you do today
> and what is frustrating or missing. We will not pitch a product or discuss
> pricing. Taking part is optional. You can skip any question or stop at any
> time without giving a reason.
>
> With your permission, I will take written notes under a participant code. We
> will not record audio or video or collect names, handles, contact details, or
> other identifying details in the notes. Please avoid sharing those details.
> The notes will be stored at [approved private location], accessible only to
> [approved viewers], and deleted on [approved date]. We may share an anonymous
> summary of themes. Direct quotations will only be used with your separate
> permission and after removing identifying details.
>
> You can ask me to remove any answer or all your notes during this session.
> Afterward, use this same scheduling channel and your participant code before
> [approved deletion date] to request deletion. Once information is combined
> into an anonymous summary, we may be unable to isolate your contribution.
> Do you agree to participate and to written notes under these terms?

Record an explicit yes/no, date, protocol version, and participant code before
continuing. Silence is not consent. If declined, stop without substantive notes.
If consent is withdrawn, stop and delete the relevant notes; exclude them from
analysis. Do not retain a declined person's identifying details. Quote permission
is optional and defaults to no; confirm each proposed quote at the end.

## Thirty-minute interview guide

Use neutral prompts and ask for recent examples. Do not show the application,
suggest desired features, or interpret agreement as demand. If the participant
has no example, mark it unanswered rather than supplying one.

| Minutes | Questions and optional probes |
| --- | --- |
| 0–3 | Read consent script and record the answer. |
| 3–7 | Which city-builder or simulation games have you played recently? Tell me about your most recent session: what were you trying to do, and what happened? |
| 7–13 | Walk me through how you currently plan, investigate, or solve problems in a game. What tools do you use inside or outside it? What did you use last time? Where did that approach fall short? What did you do instead? |
| 13–19 | What question have you wanted a simulation to answer but could not answer with your current tools? Tell me about the last time that came up. How did you try to answer it? What would make an answer useful or believable? If none comes to mind, record that. |
| 19–25 | Tell me about a city-builder or simulation game you stopped playing or took a long break from. What happened before you stopped? What did you do instead? Have you returned, and why? If you have not stopped one, what has kept you playing? |
| 25–28 | Of the difficulties you described, which mattered most in that situation? What was the consequence? What have I misunderstood or missed? |
| 28–30 | Read back the main points for correction. Confirm permission for any specific anonymous quote. Offer removal of any answer, repeat the withdrawal process, and thank them. |

Useful follow-ups: “Can you give a specific example?”, “What happened next?”,
“How often has that happened recently?”, and “What makes you say that?”
Distinguish reported behavior from wishes and moderator interpretation. Do not
ask willingness to buy, prices, or leading questions about HappyBearLandia.

## Private interview notes template — copy once per consenting participant

Store completed notes privately, outside Git, issues, and public PRs. Codes
P01–P05 identify distinct consenting participants; they are not fabricated slots
of evidence. Redact identifying details even if volunteered. Retain only the
minimal consent record within the notes, not a signed identity document.

```text
Participant code:
Interview date / duration:
Protocol version:
Consent to participate and written notes: yes/no; recorded at:
Consent script read with approved storage/viewers/deletion terms: yes/no
Quote permission: no by default; exact approved excerpt(s), if any:
Eligibility confirmed (adult, recent city-builder/simulation play): yes/no
Games and broad experience (no account names):
Current tools and recent concrete example:
Unanswered simulation question and attempted workaround (or none):
Stopped-playing example and reason (or not applicable):
Most consequential difficulty and reported consequence:
Participant corrections:
Evidence excerpts, labeled verbatim or paraphrase, with note IDs E01…:
Moderator interpretation, separately labeled:
Missing answers / uncertainty / interruptions:
Withdrawal or answer removal and action taken:
Included in synthesis: yes/no and reason
```

## One-page theme summary template — pending interviews

Do not populate findings until real consented notes exist. Target one page;
publish only anonymized synthesis after checking for identifying combinations.

```text
SHE-257 discovery summary — date / protocol version
Completed consenting interviews: __/5; included in analysis: n=__.
Recruitment channel and selection method (no participant identities):
Experience coverage, withdrawals/exclusions, and missing answers:

Theme | Participants mentioning it (k/n) | Anonymous evidence IDs | Exceptions
[Leave empty until supported by interview notes.]

Current tools and workarounds:
Questions participants wished simulations could answer:
Reasons for stopping or continuing play:
Interpretation / hypotheses for further investigation:
Next research question:

Limitations: Five volunteers are a small, self-selected sample. Themes describe
these participants' reports, not market evidence or demonstrated demand.
```

Count each participant once per theme, regardless of repeated mentions. Keep the
theme-to-participant/evidence mapping private; the public summary can cite codes
only where reidentification risk is low. Count counterexamples and distinguish
“not asked/no answer” from disagreement. State the actual denominator and any
exclusions; never report five completed interviews from five invitations.

## Completion checklist

- [ ] Guide and consent script committed through the authorized Git workflow.
- [ ] Human approves recruitment method, channel, invitation, and handling terms.
- [ ] Five actual 30-minute interviews completed; each has recorded consent.
- [ ] Five private note sets reviewed for unnecessary personal details.
- [ ] One-page summary states sample size and traceable participant theme counts.
- [ ] Findings distinguish participant reports from interpretation and market claims.

Preparation can be reviewed now. Recruitment, interviews, notes, and synthesis
remain pending; do not mark SHE-257 complete or dispatch automated outreach.
