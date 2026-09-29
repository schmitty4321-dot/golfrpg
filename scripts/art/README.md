# Blender hole art

Export a mapped course and optional hole number from the repository root:

```powershell
npx tsx scripts/art/renderHoles.ts <output-directory> waialae 1
blender -b -P scripts/art/hole3d.py -- <output-directory>/waialae/hole-01.json <output-directory>/waialae/hole-01-3d.png
python scripts/art/compose.py <output-directory>/waialae/hole-01.json <output-directory>/waialae/hole-01-3d.png <output-directory>/waialae/hole-01-page.png
```

Use the full executable path if Blender or Python is not on PATH. Composition requires Pillow.
The exporter defaults to Augusta's front nine for existing callers. The JSON feeds Blender; the SVG is only a reference map.

Real outlines come from public/holes and the line of play from src/engine/realHoles.json. The existing scene builder can fill unmapped surfaces with illustrative geometry. Height, vegetation size and lighting are art direction, not surveyed elevation. When there are no mapped trees in the cutout, Blender adds deterministic decorative trees clear of mapped playing surfaces and paths. The camera is orthographic, tilted 55 degrees from vertical.

The composed page uses a 16:9 course-guide layout with an oblique camera, landscaped ground, tropical planting and OpenStreetMap attribution. Mapped fairways, greens, bunkers and water retain their real outlines; the elevation, surrounding canopy and flowers are illustrative. Keep rendered PNGs and other large outputs outside Git until approved.

## Runtime tracer

The tracer is image-first. `IllustratedTracer.tsx` lays projected shot arcs and numbered positions over the wide course render; Fairway Manager keeps ownership of the scorecard, strategy choices, commentary and replay controls around it. Waialae Hole 1 is the first illustrated hole. Courses without an illustrated asset still use the existing map renderer while the art set is built.

For local review, copy the wide render to `public/art-demo/waialae-hole-01-course.png`, run `npm run dev`, and open `/?demo=waialae-tracer`. The whole `public/art-demo/` directory is ignored so rendered assets cannot be committed accidentally.
