# Waialae Hole 1 illustrated tracer prototype

Start with `npm ci`, then `npm run dev`. Open `http://localhost:5173/?demo=waialae-tracer&hole=1` (use the port Vite prints).

- Select **Next shot** to reveal one stroke. **Previous shot** moves back.
- **Play/Pause** runs or pauses the sequence; **Replay hole** starts again.
- Switch **Illustrated 3D / Current view** at any point. The score and revealed shot stay the same.
- The normal tournament replay also uses the new view for Waialae Hole 1, with its existing round, hole, scoring, pin, and playback controls.
- The direct review page is available in the development server only. `npm run preview` serves the production game, where the tournament replay contains the pilot.

## What the prototype does

`ProjectedHole` uses the same yard coordinates as `traceHole` and the mapped outlines loaded by `useHoleMap`. `holeProjection` applies one orthographic camera to terrain, flag, shot starts, shot landings and ground shadows. Flight height is a presentation-only parabola. Putts and penalty drops stay on the ground. No painted landing targets, route warping, terrain snapping or changes to the scoring engine are involved.

The existing `holeArt.ts` / Blender exporter can synthesize missing fairways and decorative trees. This runtime pilot uses the mapped polygons directly instead, so it does not invent scenery. The corridor edge is a presentation crop, not a surveyed property boundary. Elevation is flat; flight heights, colors, soil edge and lighting are illustrative. There are no individual mapped trees here, so none are added. OpenStreetMap attribution remains visible.

The current-view toggle uses the existing top-down `HoleDrawing`; older illustrated assets and other holes retain their existing rendering. No new raster assets or external rendering services are required.

## Checks

- `npm test -- --maxWorkers=2`: 72 files, 458 tests passed, including the new projection regression test.
- `npm run build`: passed. Existing missing challenge-board artwork and large bundle warnings remain.
- Browser: both views at 1280 × 900 and 390 × 844, light and dark themes; no page overflow at phone width; next shot, view switching and replay completion checked.
- New test covers scores 3–8 and all four round pins, exact flight endpoints, ground putts/drops and final pin alignment.

This is a first geometry-led visual prototype, not a fully modeled or surveyed 3D course.

Use **Open game replay** on the review page to inspect the actual tournament replay modal with a sample scorecard. The phone dialog is constrained to its overlay, and both its bounding box and Close button were checked. Focused replay suites passed again after the review-page changes: 26 tests in 3 files. Final visual review scored the dialog width and header findings resolved.
