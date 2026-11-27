# Corrected concept audit — source and lore

## Core correction

Owner wants an expandable elemental fantasy setting, not a prescribed five-faction world. New Lightning, Blood, Forest or other elements can appear whenever creatively useful; no derivation requirement. A new group could oppose the first five, eventually earn trust and become allies; playable access can follow. Need deeper meaning than victory instantly creating friendship. Other discovery routes: nature, research, inheritance, trade, teaching, friendly encounters. Possible narrative sequence discovery → conflict → understanding → shared challenge → alliance/knowledge exchange → mechanical expansion. Do not repeat this formula for every element.

## Source-level evidence

Four locked prototype engines use enemy status plus a different incoming element to trigger pair reactions, not necessarily adjacent towers. This corrects owner's tentative phrase "2 same towers" without changing intent. Sonnet checks other element, active status, noReact, depth 0, reactionCd; GLM tryCombo checks different status/time and recursion/cooldown; Argon apply status checks existing different element and recursion/cooldown; Neon finds previous different status, depth 0, cooldown. GLM/Argon/Neon explicitly clear both statuses; Sonnet trigger reaction has its own consumed-status behavior. Reaction cooldown around 1.2s. Status ordering differs; prototype behavior not identical. No runtime tests run in this audit.

| Prototype | Proximity constant | Source |
| --- | --- | --- |
| Sonnet | 150px RESONANCE_DIST | constants/renderer.ts |
| Argon | 165px RESONANCE_MAX_DIST | constants/engine/renderer.ts |
| GLM | 170px RESONANCE_RANGE | constants/renderer.ts |
| Neon | 215px RESONANCE_RADIUS | index.html |

Resonance lines are visual/proximity indicators; Argon computes different-element tower link pairs. No evidence these distances gate the ordinary reaction functions. Some map conduits grant range bonuses (separate mechanic). No canonical threshold selected. Shops expose all five tower types, not lore evidence for universal individual ability. Map renderer draws crimson Hanko sanctuary exits; what sanctuaries actually protect remains unknown.

## Ten existing reaction concepts

| Pair | Reaction |
| --- | --- |
| Water + Fire | Scalding Steam |
| Water + Air | Monsoon Squall |
| Water + Earth | Mudslide |
| Water + Ink | Spreading Wash |
| Fire + Air | Firestorm |
| Fire + Earth | Molten Slag |
| Fire + Ink | Scorched Lacquer |
| Air + Earth | Sandstorm Shrapnel |
| Air + Ink | Calligraphy Gale |
| Earth + Ink | Petrified Seal |

Prototype statuses Wind-Touched, Burning, Soaked, Fractured, Stained. Pair effects are not necessarily permanent elements.

## Proposed distinctions

Reaction: different elemental attacks interact at target, temporary effect. Resonance: nearby compatible seals connect, potentially strengthen cooperation; actual future bonus undecided. Fusion: deliberately combined attack, power, material, new form or element originating from player-side powers; can require proximity or intrinsic combined inscription. Proposed three layers; not approved mechanics.

Potential standalone or fusion-derived candidates: Lightning (electricity/chaining), Blood (vitality), Forest (growth), Ice (crystallization), Sand (abrasion), Dark Fire (unusual burning), Metal (armor/conductivity), Light (radiance), Shadow (concealment). Example possible derivations only: Sand Air+Earth; Ice Water+compatible force; Steam Water+Fire; Magma Fire+Earth; Dark Fire Fire+Shadow. Natural element and reproduced fused power may coexist, distinction open. No maximum roster; no complete combination requirement. For n independent elements, unordered distinct pairs n(n−1)/2 and triples n(n−1)(n−2)/6. Examples 5→10 pairs/10 triples; 10→45/120; 20→190/1140; 30→435/4060. Combinatorial growth is a cost, not a production target.

## What is protected?

Four possibilities: sanctuaries as communities/sacred resources; settlements/castles; powerful protective seals/artifacts; scroll worlds as representations or literal magical spaces. Multiple mission types possible. No decision.

## Player access to five elements

A Seal Keeper (trained in several); B Alliance Commander (commands several specialists); C Collector (acquires seals); D Universal Crafter (learns different inscriptions); E Shared Sanctuary (five allied contributions); F Individual Specialists (different characters contribute). B+C+E was a provisional story recommendation, not approved. Do not equate shop access with every person mastering five elements.

## Model and order

Early proposed chain: wielder activates seal, seal manifests origami construct, construct protects sanctuary. Owner clarified original intention: separate physical origami figure receives seal; do not conflate seal and figure.

Discussion order proposed: nature of elemental power; seals; wielders; origami manifestations; sanctuaries; reactions; resonance; fusion; elemental discovery; conflict/alliance; inhabitants/geography; long-term progression. Do not lock before discussion. See [evidence](12-evidence.md).
