# Icon Style Principles

The current repository baseline is a 24 × 24 grid with a 1.25 px default line
stroke at 24 px, as documented in [`README.md`](../README.md).

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

- Make Filled a deliberate, legible filled interpretation—not simply a heavier
  outline. Preserve meaningful counters and open negative space. If a symbol
  does not naturally support a filled form, use a considered alternative rather
  than forcing a solid silhouette.
- Keep Duocolor and Duotone variants coherent with their base icon. Use color
  for meaningful details; do not split a continuous outline just to introduce
  a second color.
- Keep color and stroke controls editable so users can adapt icons without
  manually changing individual paths.

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

## Verification

- Don't trust the layers panel. After every change, look at a 6–8× zoomed
  screenshot and at the actual 24 px size.
- Where a visual judgement can be expressed as a number (optical size,
  inset, cap or corner radius, part proportions), write the number down here
  and measure against it.
- When a correction is made during review, add it to this document as a rule
  so the same fix doesn't have to be repeated.

## Review checklist

- Is the meaning clear at 24 px?
- If this was a refinement, is the original structure intact?
- Does it reuse the shared parts and baselines of its related icons, and does
  it look like family when placed next to them?
- Are caps, joins, and corners still correct in a zoomed-in screenshot?
- Does the icon sit cleanly on the grid with its intended inset?
- Are its stroke weight, rounding, and optical balance consistent with the set?
- Are all internal details contained and free of accidental overlaps?
- Do its style variants preserve the same recognizable structure?
