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

## Review checklist

- Is the meaning clear at 24 px?
- Does the icon sit cleanly on the grid with its intended inset?
- Are its stroke weight, rounding, and optical balance consistent with the set?
- Are all internal details contained and free of accidental overlaps?
- Do its style variants preserve the same recognizable structure?
