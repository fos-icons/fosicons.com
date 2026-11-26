# Icon Style Principles

The current repository baseline is a 24 × 24 grid with a 1.25 px default line
stroke at 24 px, as documented in [`README.md`](../README.md). Every icon also
has a 48 × 48 optical size with a 2 px stroke; see
[Optical sizes: 24 px and 48 px](#optical-sizes-24-px-and-48-px).

## Visual character

- Keep the icons recognizable and visually coherent as one family.
- Favor a friendly, softly rounded character. Use restrained corner rounding
  and squircle-like forms where the shape calls for them; avoid both sharp,
  mechanical corners and excessive rounding.
- Keep strokes balanced and not overly heavy. Make stroke weight editable
  through the shared variable rather than adjusting paths independently.

## Grid and geometry

- Fit each icon to the shared 24 × 24 grid and align it to the Figma pixel grid.
  Respect the intended inset and padding; optically adjust individual shapes
  when needed without making the icon feel merely scaled up or down.
- Design for clarity at the actual UI size. Check the finished icon in its grid,
  not only enlarged.
- Use outside references to understand a metaphor, then adapt custom icons to
  Fos's visual language rather than copying an unrelated style.

## Optical sizes: 24 px and 48 px

The 48 px icons are a true optical size, not the 24 px icons scaled up 2×.
Large icons get relatively thinner strokes and squarer containers, so they
read lighter and more crafted at display sizes while staying in the same
family.

### Stroke weight

| Size | Stroke | Stroke as share of canvas | Live area |
|---|---|---|---|
| 16 px | **1 px** | ≈ 6.3% | 13.33 × 13.33 (1.33 px padding, 24 geometry × 2/3) |
| 24 px | **1.25 px** (unchanged) | ≈ 5.2% | 20 × 20 (2 px padding) |
| 32 px | **1.5 px** | ≈ 4.7% | 26.67 × 26.67 (2.67 px padding, 24 geometry × 4/3) |
| 48 px | **2 px** | ≈ 4.2% | 40 × 40 (4 px padding) |
| 64 px | **2.5 px** | ≈ 3.9% | 53.33 × 53.33 (5.33 px padding, 24 geometry × 8/3) |

- Small sizes are relatively heavier and large sizes relatively lighter; the
  stroke steps 1 → 1.25 → 1.5 → 2 → 2.5 across 16 / 24 / 32 / 48 / 64.
- 16 px: Filled line-only outline 2 px; badge 6.67 × 6.67 with 0.83 px
  clearance; embedded parts scaled × 2/3 use the `32 px` mode (1.5 × 2/3 = 1).
- 64 px: Filled line-only outline 5 px; badge 26.67 × 26.67 with 3.33 px
  clearance; embedded parts scaled × 8/3 use `64 px · scaled` (0.9375 × 8/3 =
  2.5).
- 32 px sits between 24 and 48 on every axis: stroke 1.5, squircle *k* 0.76,
  Filled line-only outline 3 px, badge 13.33 × 13.33 with a 1.67 px clearance.
  Geometry is an exact × 4/3 of 24 px (non-integer padding is accepted so
  proportions stay identical across sizes). Embedded parts scaled × 4/3 use
  the `32 px · scaled` stroke mode (1.125, so 1.125 × 4/3 = 1.5 px).

- 48 px is deliberately *not* 2 × 1.25 = 2.5 px. A plain 2× scale reads heavy
  at 48 px, and 1 px at 24 px / 2 px at 48 px was rejected because it is only a
  scale. It also makes 24 px too thin and forces a redraw of every Filled
  cut-out and modifier clearance.
- Options tested and rejected for 48 px: 0.85 px (hairline, soft on non-retina
  screens), 1.7 px (good, but slightly light), 2.5 px (today's scaled-up look,
  too heavy).
- The Figma stroke variable `Fos / Stroke → icon/stroke-width` holds the
  sizes as modes: 16 px = 1, 24 px = 1.25, 32 px = 1.5, **48 px = 2**,
  64 px = 2.5 (plus `32 px · scaled` = 1.125 and `64 px · scaled` = 0.9375 for
  embedded parts). Regular,
  Duocolor, and Duotone strokes are always bound to it; never type a stroke
  weight by hand.
- The website draws each size from the nearest optical size (`opticalSize`
  in `src/lib/catalog.ts`), and its automatic stroke is each size's designed
  stroke in 24 px grid units: 1.5 at 16, 1.25 at 24, 1.125 at 32, 1 at 48,
  0.9375 at 64, linear in between (`exactAutoStroke` in `src/lib/look.ts`).
  At an optical size the artwork is drawn exactly as designed.

### Squircle containers

Containers named `*-circle` (and other "soft round" frames) use the Fos
squircle, defined by its cubic handle ratio *k*: the handle length divided by
the half-width, with handles parallel to the sides.

| Size | Squircle | Handle ratio *k* | Read |
|---|---|---|---|
| 16 px | Fos squircle | **0.68** | same as 24 (small sizes stay soft) |
| 24 px | Fos squircle | **0.68** | soft, rounded squircle |
| 32 px | Fos squircle · 32 | **0.76** | in between (option B) |
| 48 px | Fos squircle · 48 | **0.84** | flatter sides, tighter corners |
| 64 px | Fos squircle · 64 | **0.88** | squarest, close to the `squircle` shape |

- At 48 px with a 2 px stroke, *k* 0.68 starts to read as a circle, so 48 px
  containers use *k* 0.84 (option C, chosen over 0.68 and 0.76). The radius
  and centre stay the same as the 2× geometry; only the corner tension changes.
- True circles (*k* ≈ 0.55), the `squircle` shape icon (already *k* ≈ 0.88),
  and other rounded forms are not converted.
- Square layout frames (`layout-sidebar-*`, `layout-panel-*`) use a plain
  rounded square (radius 2.6 at 24 px), not a squircle, so they read as
  windows.

### 48 px grid and keylines

Use **Icon Grid Template-48px** on the Figma Scratchpad for drawing and
verification. Its layers are locked, and its spec is stored on the frame as
plugin data (`gridSpec`).

- Live area 4–44 (40 × 40); centre lines at 24; thirds at 18 and 30; diagonals;
  2 px pixel grid.
- Keylines: circle 40; square 36 (radius 2); portrait 32 × 40; landscape
  40 × 32; Fos squircle · 48 (*k* 0.84, 40).
- Badge zone: 20 × 20 badge, 2.5 px from the canvas edge (bottom-right
  25.5, 25.5), with a 2.5 px clearance around it.

### Building a 48 px icon

- Every component set holds both sizes as variants: `Style=…, Size=24` and
  `Style=…, Size=48`, in all four styles. Each 48 variant has the explicit
  `48 px` stroke mode set.
- Regular, Duocolor, Duotone: start from the 24 px geometry ×2, rebind every
  stroke to the stroke variable (2 px), and upgrade squircles to *k* 0.84.
  Then make optical fixes where the thinner stroke opens gaps (dots, short
  ticks, tight counters).
- Filled: rebuild at 48 px so cut-outs are 2 px wide, not a scaled 2.5 px.
  Filled line-only icons (no closed container) use an outline at 2× the
  Regular stroke: 2.5 px at 24 px and 4 px at 48 px. Where the 24 px Filled is a
  designed solid shape (thumbs, pencil, ring, rotated half shapes), the 48 px
  Filled keeps that design.
- If a heavy Filled outline overshoots the padding, scale that Filled shape
  about the centre until it fits 4–44. Never let it cross the live area.
- Modifiers (badges) at 48 px are 20 × 20 with a 2.5 px clearance: the 24 px
  10 × 10 badge and 1.25 px clearance, doubled. Badge colours and positions
  match the 24 px icon.
- Embedded parts scaled ×2 (shared bases such as `Base / Image`, file labels,
  and badges) must still render 2 px strokes, not 4 px. Set the `16 px` stroke
  mode on the scaled instance so 1 × 2 = 2 px.

### 48 px verification

- Check every 48 variant against Icon Grid Template-48px: all artwork inside
  4–44, unless the 24 px design overshoots by the same proportion (for example
  `carrot` or `violin`). Badges may extend into the badge zone, as at 24 px.
- Compare each 48 icon with its 24 icon ×2 side by side. The 48 must read as
  the same icon, only lighter. A visibly different silhouette or a hollow
  Filled where the 24 is solid is a bug.

## Stroke and detail quality

- Keep internal strokes contained within their enclosing shapes unless an
  intentional detail calls for an extension.
- Avoid accidental overlaps, protruding strokes, and misaligned joins.
  Internal lines should sit cleanly against the outer form and remain balanced.
- Use symmetry when it supports the symbol; don't force mechanical symmetry
  onto forms that should look natural.
- Keep related geometry consistent across Regular and Filled interpretations.
- Lead with straight lines and add small corners afterwards; avoid large radii
  that turn a shape into a blob.
- Build negative space with real boolean operations (subtract, exclude), never
  with white or background-colored fills faking a cut-out. Fake cut-outs break
  as soon as the icon is recolored or placed on a different background.

## Shared parts

- Icons that show the same object reuse the same master part: the same
  proportions, details, and baseline, not a fresh redraw each time. A shape
  that appears in several icons (a document, a pin, a bolt, a person) should be
  built once and reused.
- Small shared decisions count, such as where a baseline or ground line sits,
  how big a badge or modifier is, and where it attaches. Keep these the same
  across every icon that uses them.
- Judge each icon next to its related icons in the set, not on its own. An
  icon that looks right alone can still look like it came from another set.

## Editing existing icons

- Refining is not redesigning. When asked to refine, keep the structure
  (viewpoint, composition, and placement of parts) and change only the details
  in question.
- Fix an icon that looks too small or too large through proportion and longer
  straight segments, not by stretching or scaling the shape. Stretched shapes
  turn chubby and toy-like.
- Symbols that come from a standard (for example ISO 7000 or IEC 60417, as for
  the power symbol) keep their standard structure. Only stroke, caps, gaps, and
  size may be tuned to fit the set.
- Check for regressions after every path edit. Rewriting a path can silently
  flatten round caps or sharpen corners elsewhere in the icon.

## Style variants

- Every icon has four styles: Regular, Filled, Duocolor, and Duotone. Any
  redraw or edit covers all four in the same pass, built on the same geometry,
  and each must be finished to the same standard. Never leave one style on old
  geometry.
- Make Filled a deliberate, legible filled interpretation—not simply a heavier
  outline. Preserve meaningful counters and open negative space. If a symbol
  does not naturally support a filled form, use a considered alternative rather
  than forcing a solid silhouette.
- Keep Duocolor and Duotone variants coherent with their base icon. Use color
  for meaningful details; do not split a continuous outline just to introduce
  a second color.
- Keep color and stroke controls editable so users can adapt icons without
  manually changing individual paths.

## Animated icons

Animated icons are Regular icons that move. They are generated, never drawn
by hand: add a spec to `metadata/animated.json` in `fos-icons`, then run
`npm run animate`. The motions are documented in
`skills/fos-icons-animate/SKILL.md`. Don't run SVGO on these files.

**The motion tells the icon's story.** Show what the object does in real life,
not a generic wiggle:

- Things that point move where they point: arrows and chevrons nudge in their
  direction. Double chevrons ripple one after the other; selectors spread
  outward; collapse icons move inward.
- Things that fill go from empty to full and hold. A battery adds its bars
  one by one (0 → 5, borrowed from `battery-full`). An hourglass starts with
  the top full and the bottom empty. The top drains quickly toward the neck
  while the bottom fills from the top down. Then the whole glass turns over
  (180°), so the full sand ends on top and the loop starts again seamlessly.
- Things that open, open upward. A trash lid lifts from its right-hand hinge,
  just enough to read: about 9°, never past the icon's edge.
- Parts that move at different rates in real life do so here too. A clock's
  minute hand turns 12× faster than its hour hand (3 s and 36 s).
- Signals and progress reveal in order. Wi-Fi arcs light from the dot outward,
  sound waves fade from the speaker, and checks and crosses draw their strokes
  in writing order.
- Attention icons (bell, alert) swing from their natural pivot, with a decay.
- When a motion "doesn't look right", replace it; don't tune it. A mail flap
  flipping read as broken, so mail hops and wiggles instead.

**Rest pose.** With the animation off (reduced motion, or a grid cell that
isn't hovered), the icon must look like its normal still drawing. Parts that
only exist during the motion, such as the hourglass's bottom sand, are hidden
at rest (`base` in the spec).

**Bounds.** Every frame stays inside the 24 px icon: 2–22 live area,
stroke included. Check the extreme frames, not just the rest pose. In SVG's
y-down space, a positive rotation lifts the left side of a part hinged on
its right.

**Timing.** Loops of 1–3 s, with small moves (under 3 px or 15°) and the
library easing `cubic-bezier(.65,0,.35,1)`. Only a slow secondary part, like
an hour hand, takes longer. Loops restart from the rest pose, or from a
symmetric angle (90° for a plus, 72° for a star, 45° for sun rays), so they
never visibly jump.

**Scope.** Animate the icons people use most (status, loading, actions,
navigation), not the whole library. When one icon in a family is animated,
animate the whole family (every chevron, not just one).

**Code rules** (the generator enforces these):

- Class and keyframe names are prefixed `fa-<name>-`. An inline `<style>`
  applies to the whole page, so a bare `.c` once moved the page's own cards.
- Moving parts are top-level groups with no transformed ancestor, so their
  origins are plain 24px-grid coordinates.
- Every icon stops under `prefers-reduced-motion`.

**Review.** Render frames across the loop, at rest and at about 250, 500 and
800 ms (plus later frames for long loops), with the 24 px boundary drawn.
Check the story, the rest pose, the bounds, and that the loop has no jump.
Hover-test on the site's Animated tab before calling it done.

## Brand marks

- Keep third-party logos authentic and unmodified, separate from the custom core
  icon style. Adapt non-brand reference icons to Fos's style.

## Product and workflow instructions

- Prioritize coverage of real user needs over increasing the icon count.
- Make icons easy to find with predictable names, sensible categories, useful
  previews, and relevant synonyms.
- Keep design and code aligned: preserve canonical names and geometry across
  Figma, SVG exports, and generated packages so handoff does not require
  redrawing or reinterpretation.
- Whenever the grid or icon dimensions change, recheck every icon against the
  updated grid and at its intended UI size.
- Keep icon descriptions concise and focused on the name, meaning, and useful
  synonyms. Avoid drawing-specification boilerplate such as pixel-grid or
  cap-style details.

## Approval

- All new designs and redraws start as drafts on the Figma **Scratchpad**
  page, never on any other page. Lay them out with 8× previews and an
  actual-size comparison against the current icon.
- The owner approves drafts visually. Only then are components created or
  updated on the Components page, and the approved drafts removed from the
  Scratchpad.
- Only approved changes are applied to the component and synced onward to the
  `fos-icons` packages and the website.

## Verification

- Don't trust the layers panel. After every change, look at a 6–8× zoomed
  screenshot and at the actual 24 px size.
- Where a visual judgement can be expressed as a number (optical size,
  inset, cap or corner radius, part proportions), write the number down here
  and measure against it.
- When a correction is made during review, add it to this document as a rule
  so the same fix doesn't have to be repeated.

## Review checklist

- Is the meaning clear at 24 px, and at 48 px?
- At 48 px: is the stroke 2 px, are squircles *k* 0.84, and does the icon sit
  inside the 4–44 live area?
- If this was a refinement, is the original structure intact?
- Does it reuse the shared parts and baselines of its related icons, and does
  it look like family when placed next to them?
- Are caps, joins, and corners still correct in a zoomed-in screenshot?
- Does the icon sit cleanly on the grid with its intended inset?
- Are its stroke weight, rounding, and optical balance consistent with the set?
- Are all internal details contained and free of accidental overlaps?
- Do its style variants preserve the same recognizable structure?
- If it's animated: does the motion tell the icon's story, does it rest as the
  still icon, and does every frame stay inside the icon?
