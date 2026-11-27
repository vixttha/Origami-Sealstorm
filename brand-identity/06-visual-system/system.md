# Visual system — proposed paper-and-ink direction

These are candidates, not a locked palette. Element colors are sampled from existing prototype definitions; brand neutrals, crimson and gold are proposed. Maintain separate semantic roles for brand accents, combat colors and alerts.

| Role | Hex | Use |
| --- | --- | --- |
| Washi paper | `#F5EBDD` | Light surface |
| Sumi ink | `#1D1E2C` | Text / dark base |
| Seal crimson | `#9E2939` | Brand accent |
| Muted gold | `#B88A45` | Decorative accent |
| Air / Kaze | `#2A9D8F` | Element cue |
| Fire / Kagura | `#E63946` | Element cue |
| Water / Mizu | `#3A86FF` | Element cue |
| Earth / Tsuchi | `#D4A373` | Element cue |
| Ink / Sumi | `#1D1E2C` | Element cue |

Computed sRGB contrast candidates (WCAG relative luminance method; calculation is not a full accessibility audit):

| Foreground / background | Ratio | Proposed use |
| --- | --- | --- |
| Sumi on washi | 13.98:1 | Main text |
| Washi on sumi | 13.98:1 | Dark theme text |
| Seal crimson on washi | 6.29:1 | Accent text subject to visual review |
| Muted gold on washi | 2.63:1 | Decorative only; not ordinary text |
| Air / Kaze on washi | 2.82:1 | Gameplay swatch; pair with icon/label; avoid low contrast text |
| Fire / Kagura on washi | 3.53:1 | Gameplay swatch; pair with icon/label; avoid low contrast text |
| Water / Mizu on washi | 2.95:1 | Gameplay swatch; pair with icon/label; avoid low contrast text |
| Earth / Tsuchi on washi | 1.92:1 | Gameplay swatch; pair with icon/label; avoid low contrast text |
| Ink / Sumi on washi | 13.98:1 | Gameplay swatch; pair with icon/label; avoid low contrast text |

Typography: explore a high-legibility serif or crafted display face for title only; use a neutral humanist sans for UI, tabular numerals for combat stats, and fallback system fonts. Select actual fonts only after license and readability review. No external font assets imported.

Art grammar: wide folded facets, washi texture kept outside text, sumi brush trails, stamped circles and squares, angular elemental silhouettes, paper confetti for enemy peeling. Five glyph/shape identities should be distinguishable without color: Air curved fan or wing, Fire lantern or flame, Water wave or koi, Earth angular shard, Ink droplet or brush stroke. These are candidate motifs, not approved assets. Confirm Japanese labels with a qualified reviewer. Avoid red/green-only status communication; add outlines, text and shape. Reserve gold for milestone emphasis; use motion sparingly and support reduced-motion preferences.

Battlefields: Winding Calligraphy River, Twin-Bridge Crossover and The Spiral Shrine inspire winding brush paths, bridge geometry and spiral compositions. Do not use map decoration where it obscures buildable space or combat effects. Separate gameplay asset production from public brand asset approval.

Source: [OS product brief](https://github.com/vixttha/Origami-Sealstorm/blob/bce4095da1dd9cb9ff9d34afb61f157fe09a5ae7/README.md) · [Provenistem ideas](https://github.com/vixttha/Origami-Sealstorm/blob/8ec45b24e7d1f2ec58e109e2288b3bb5c9689853/ideas/INDEX.md) · [Sonnet mechanics](https://github.com/vixttha/Origami-Sealstorm/blob/fa10c32339ad3a97d4bb430b8e0408625037b774/src/lib/constants.ts) · [GLM mechanics](https://github.com/vixttha/Origami-Sealstorm/blob/55a3bfd4fcaee5c3260bd67993fb64ac9fd0d4e1/src/lib/constants.ts)
