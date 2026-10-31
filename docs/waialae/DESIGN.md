---
name: Waialae Hole 1 projected runtime view
description: Scoped geometry-led replay pilot within the existing Golf RPG interface.
colors:
  surface: "#e9eee2"
  grass-light: "#7bb85c"
  grass-deep: "#326840"
  fairway: "#82bd57"
  fairway-stripe: "#93c96a"
  rough: "#437b41"
  woodland: "#28583b"
  water: "#479eae"
  tee: "#b1d781"
  green: "#b5dc80"
  bunker: "#f2dfb0"
  ground-edge: "#5c4930"
  flight: "#fff4bf"
  penalty: "#e99073"
  flag: "#d65539"
  label: "#244c35"
  caption: "#36513d"
  attribution-link: "#245a36"
typography:
  hole-label:
    fontSize: "18px"
  illustration-label:
    fontSize: "14px"
  caption:
    fontSize: "12px"
rounded:
  canvas: "12px"
components:
  projected-hole:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.canvas}"
    width: "100%"
---

# Design System: Waialae Hole 1 projected runtime view

## Overview

**Creative North Star: "The mapped course diorama"**

This document applies only to the new Waialae Hole 1 projected replay view, its attribution, and its flight rendering. It does not define or replace the app's existing visual system. Preserve the surrounding navigation, replay controls, typography, themes, and other course views.

**Key Characteristics:**
- One orthographic camera for mapped geometry and replay coordinates.
- Mapped land features, restrained illustrative depth, and legible replay paths.
- Explicit separation between measured outlines and illustrative height.

## Colors

Primary terrain colors distinguish striped fairway, rough, woodland, water, tee, green, and sand. The warm flight stroke remains readable over the course; salmon identifies penalties. A red flag locates the actual pin. The pale neutral canvas and deep green labels belong to this view only. Color values above are extracted from the implementation; small feature outlines remain defined in the component.

## Typography

Inherit the existing interface font. The SVG hole label and illustration note use the extracted sizes; attribution remains HTML text beneath the image so its link stays usable. Do not introduce a new font identity for this pilot.

## Layout

The SVG uses a logical canvas of 1200 × 620, scales to its container width, and preserves its aspect ratio. A single camera fits the layout bounds within the drawing area. The course surface is clipped to a rounded corridor along the layout path; this corridor is illustrative presentation, not a measured course boundary. Caption padding is 10px vertically and 16px horizontally. The preview stacks to one column at 700px. The cinematic replay modal fits the padded overlay with width min(1280px, 100%), max-width 100%, and min-width 0, preventing horizontal overflow.

## Elevation & Depth

Terrain elevation is flat. The offset brown ground edge, grass gradient, and mapped tree symbols convey illustrative depth without claiming surveyed topography. Shot height is a parabola capped at 38 world units; putts and penalties remain at ground level. All flight samples pass through the same camera as their world endpoints.

**The Shared Camera Rule.** Project terrain, pin, tree locations, shot origins, and landing points through the same transform. Do not move a shot endpoint to make it visually fit a lie or hazard.

## Shapes

The container clips to the extracted canvas radius. Mapped polygons retain their world geometry and use rounded stroke joins. Fairway stripes are a surface pattern; tree symbols appear only at mapped tree points. No decorative vegetation or invented hazard polygons are added.

## Components

### Projected hole

The runtime replay selects this view for the Waialae pilot. It receives the existing trace, replay step, and map. While outlines load, show the loading text rather than fabricated features. Replay paths include a dashed ground connection, a flight stroke, and the actual landing marker. The latest flight draws over 800ms with ease-out; reduced-motion preference disables the animation.

The visible caption links “OpenStreetMap contributors” to https://www.openstreetmap.org/copyright and states: “Flat terrain; flight height is illustrative.” Keep this attribution with the rendered view. The SVG has an accessible image label including the hole, par, and displayed shot descriptions.

## Do's and Don'ts

- Do preserve the existing app interface around this scoped pilot.
- Do use actual mapped features and replay world coordinates.
- Do retain visible OpenStreetMap attribution and the flat-terrain disclosure.
- Don't imply that illustrative flight height is measured launch data.
- Don't add decorative vegetation, invented hazards, or lie-snapped endpoints.
- Don't apply this palette or composition as a redesign of the whole app.

