## Healatron Specification

What the app does: its terms and its features. How it is built is in
`CLAUDE.md`.

## Features

We are building an app to calculate healing from the Treat Wounds activity
in the Pathfinder 2nd edition role playing system: the odds, the average
healing, and simulated rolls showing how much is healed and how much time
passes.

* Healer panel inputs:

  * Rules version. Implemented as a selector. Values are: Remaster (Player
    Core) and Legacy (Core Rulebook). Defaults to Remaster.

  * Medicine proficiency. Implemented as a selector. Values are: trained,
    expert, master, legendary.

  * Medicine bonus. Implemented as a text box with a slider. Values are
    0 - 40.

  * Expanded Healer's Toolkit. Checkbox with a hint; adds a +1 item bonus
    to the check.

  * Medicine feats. Checkboxes stacked under the toolkit, with no group
    label, each with a hint: Continual Recovery (only enabled at expert
    or better; otherwise unchecked), Risky Surgery, Medic Dedication and
    Mortal Healing. Risky Surgery's hint also says whether, with the
    current inputs, it raises or lowers the average HP per hour and by
    how much (or makes no difference), whether or not it is checked.
    When it raises the average, the Risky Surgery checkbox and its hint
    are highlighted with a green tint.

* Target panel inputs:

  * Character level. Text box with a slider, 1 - 20. Defaults to 1.

  * Max HP. Text box with a slider, 1 - 400. Defaults to 60.

  * Current HP. Text box with a slider, 0 - max HP. Defaults to 20. If max
    HP is lowered below it, it is reduced to fit.

  * Has Godless Healing. Checkbox.

  * Has Robust Health. Checkbox with a hint; only enabled at level 3 or
    higher (otherwise unchecked).

  * DC adjustment. Text box with a slider, -10 - +10, defaults to 0: the
    GM's adjustment for the circumstances.

* Results panel:

  * Treat Wounds DC. Implemented as a selector: DC 15, DC 20 (+10 HP),
    DC 30 (+30 HP), DC 40 (+50 HP). DCs above the healer's proficiency
    are disabled; if a proficiency change disallows the chosen DC, the
    highest allowed DC is chosen. A hint says whether the chosen DC heals
    the most on average (HP per hour) or names the DC that does.

  * Treat for a full hour. Checkbox; only enabled with the Remaster rules
    (otherwise unchecked, and the hint says why).

  * Summary tiles: DC, check bonus, HP missing and average HP per hour.

  * Check odds: a bar and a list with the chance of each degree of
    success, and a line "Rolling d20 + <bonus> vs DC <dc>", noting when
    a success counts as a critical success.

  * Average HP table: average HP for each degree, the average per attempt
    and the average time between attempts. With Risky Surgery a note says
    the average per attempt includes its damage.

  * Roll until healed button. Rolls Treat Wounds attempts with fair dice
    until the target is at full HP, is brought down to 0 HP by damage, or
    200 attempts have been made. Shows a message saying how the run ended
    and the final HP, totals (attempts, net HP healed, time passed) and a
    log of every attempt: number, clock time from the start (h:mm), degree
    with the d20 roll and total, HP rolled with how it was worked out
    (e.g. "(2d8 (3, 5) + 10) × 2 + 5"), and HP before and after. A Clear
    button clears the log. Changing any input clears a shown log and says
    to roll again.

* The Healer panel (rules version, proficiency, bonus, toolkit and feats) is
  remembered in the browser and restored on the next visit. Saved values
  that are invalid fall back to the defaults. The Target panel and the
  Results panel inputs are not remembered.

* Appearance: an apothecary theme over a fixed parchment blueprint
  backdrop, softened by a wash of the page colour (heavier in dark mode).
  Each panel looks like a sheet of old paper, as in Craftalator. Potion
  red and brass are the accents: panel headers, the Roll button, checked
  checkboxes and the filled part of the slider tracks are red (the
  potion's colour) and focus rings are brass. The slider thumb is a round
  glass healing potion vial of red liquid with a cork, and a large copy
  sits left of the title. The title and panel headers use New Rocker; key
  figures use a serif; body text uses the system sans-serif. All text
  uses the full text colour. Light and dark modes follow the system.

* Layout: three panels, Healer, Target and Results. On a wide screen they
  sit side by side; on a medium screen Healer and Target stack beside
  Results; on a narrow screen all three stack.

## Treat Wounds rules

* Each attempt takes 10 minutes. The target is then immune to Treat
  Wounds for 1 hour, overlapping the treatment, so attempts start an hour
  apart. With Continual Recovery (expert or better) the immunity is 10
  minutes.

* DC 15; an expert may instead attempt DC 20 for +10 HP, a master DC 30
  for +30 HP and a legendary healer DC 40 for +50 HP. The DC adjustment is
  added to the DC.

* Degrees of success use d20 + bonus against the DC, with the natural 1
  and natural 20 rules. Critical success: 4d8 HP + the DC's bonus.
  Success: 2d8 HP + the DC's bonus. Failure: nothing. Critical failure:
  1d8 damage (the DC's bonus doesn't apply). HP never goes below 0 or
  above max.

* Full hour (Remaster only): on a success the healer may keep treating
  for a total of 1 hour to double the HP regained (dice + the DC's bonus).
  The attempt then lasts 60 minutes; a failure still lasts 10.

* Expanded Healer's Toolkit: +1 item bonus to the check.

* Risky Surgery: deals 1d8 slashing damage to the target just before the
  effects of each attempt, adds +2 to the check, and a success becomes a
  critical success.

* Mortal Healing: a success becomes a critical success. The user is
  responsible for checking the target hasn't had divine healing in the
  last 24 hours.

* Medic Dedication: on a success, +5 HP at DC 20, +10 at DC 30, +15 at
  DC 40. Robust Health (target, level 3+): +HP equal to the target's
  level on a success. Both are circumstance bonuses, so only the higher
  applies. Godless Healing (target): +5 HP on a success, stacking with
  either. All are added after any doubling.

* Time passed: from the start of the first attempt to the end of the last
  treatment. The next attempt starts after the longer of the treatment
  and the immunity.

* A run ends "down" only when damage from that attempt leaves the target
  at 0 HP; a target that starts at 0 HP keeps being treated after a
  plain failure.
