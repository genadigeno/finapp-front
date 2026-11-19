# Accessibility audit — WCAG 2.2 AA

**Task:** `P18-TSK-038` (DOD-CUST). **State, 2026-11-19 (Stage 7):** the automated part is complete and passing; the
**manual screen-reader passes have not been done** - they need a person with the assistive technology, and are the
open half of this task.

## 1. What is checked automatically, on every change

| Check | Scope | Where |
|---|---|---|
| axe (rules tagged WCAG 2.0/2.1/2.2 A and AA), no serious or critical finding | **Every page** of the production build - the start, sign-in and registration pages, and all 44 signed-in pages against a scripted finapp - light theme on a desktop, dark on a phone; every design-system component in both themes, with each dialog open | `e2e/catalogue/app-sweep.spec.ts`, `catalogue.spec.ts` |
| Nothing scrolls sideways at phone width (WCAG 1.4.10 Reflow) | Every signed-in page on a 412 px phone | `app-sweep.spec.ts` |
| Touch targets at least 44 px (WCAG 2.5.8, above its 24 px minimum) | Buttons, inputs, tabs, radio and checkbox rows, every navigation entry | `catalogue.spec.ts` |
| The main navigation fits a phone, every entry a target | Seven entries at phone width | `catalogue.spec.ts` |
| Keyboard paths | Dialogs (step-up, confirmations), wizards, review panels and forms are driven by keyboard and pointer events in the journey tests; scrollable regions (agreement text, wide tables) are focusable; focus order and focus return after a dialog are **not** asserted - part of the manual pass | component and journey tests (Testing Library `user-event`); `credit` keyboard check in `catalogue.spec.ts` |
| Contrast in both themes | Text, placeholders, status chips | axe (above); the placeholder colour was fixed at Stage 1 |
| Reduced motion | The browser checks run with `prefers-reduced-motion: reduce` | `catalogue.spec.ts`, `app-sweep.spec.ts` |

Found and fixed by the Stage 7 sweep: wide tables on the credit pages, the statement and the business owners
scrolled sideways inside regions a keyboard could not reach (axe `scrollable-region-focusable`) - now a labelled,
focusable `ScrollableTable`.

## 2. WCAG 2.2 criteria new since 2.1

| Criterion | State |
|---|---|
| 2.4.11 Focus Not Obscured (Minimum) | **Manual check needed** on phones: the bottom navigation is fixed; the page keeps a bottom padding equal to its height, but a focused control scrolled under it must be checked by hand |
| 2.4.12 / 2.4.13 (AAA) | Not targeted |
| 2.5.7 Dragging Movements | Met - nothing is dragged |
| 2.5.8 Target Size (Minimum) | Met - 44 px checked (above) |
| 3.2.6 Consistent Help | Not applicable yet - there is no help or support channel (`finapp` provides none, G-13) |
| 3.3.7 Redundant Entry | Met - nothing is asked twice in a journey except the new password's repeat, which the criterion exempts for security |
| 3.3.8 Accessible Authentication (Minimum) | Met by design - fields carry `autocomplete` (`current-password`, `new-password`), pasting is never blocked, two-step codes can be pasted; **to confirm by hand** with a password manager |

## 3. Manual passes still to do

Each pass covers registration, sign-in with a two-step code, the home page, a statement, sending money (review,
step-up, unknown outcome), an exchange with its countdown, a credit offer (reading the agreement, ticking and
accepting), and the security centre.

| Assistive technology | Browser | State |
|---|---|---|
| NVDA (Windows) | Firefox and Edge | **Not done** |
| JAWS (Windows) | Chrome | **Not done** (licence needed - the owner decides whether it is in scope) |
| VoiceOver (macOS) | Safari | **Not done** |
| VoiceOver (iOS) | Safari | **Not done** |
| TalkBack (Android) | Chrome | **Not done** |
| Keyboard only, 200% and 400% zoom, Windows high-contrast mode | Edge | **Not done** |

What to listen for: live announcements of results and errors (`role="status"`, `role="alert"`), the countdown's
timer (deliberately `aria-live="off"`, so it does not chatter - check that reaching expiry is noticed and that the
disabled confirm explains itself), the wizard's "Step n of m", the reading order
of money and its direction ("Money in" / "Money out"), and that no internal code is ever read out.

## 4. Known limits

- Only English (`en-GB`) exists; translations, right-to-left layout and number formats of other locales are untested.
- No user research with disabled customers has been done.
- The automated sweep runs against scripted `finapp` answers; a real `finapp` may send states the scripts do not.
