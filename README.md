# SGBC product website

Next.js App Router + TypeScript + Three.js. Product copy is based on the SGBC Rev C engineering documentation. The site presents a prototype, with no fabricated pricing, launch date, checkout, or mailing-list storage.

## Run

Use Node.js 22.13 or later and pnpm.

- `pnpm install`
- `pnpm dev`
- `pnpm build` creates a static export in `out/`.

The registered private Site is recorded in `.openai/hosting.json`.

## Product model

`public/models/sgbc-revc.glb` is a copy of the actual Rev C CAD export from `../gb-fpga-core/hardware/revC/enclosure/output/SGBC_RevC_colored.glb`. Original engineering files remain unchanged. The Three.js viewer applies beige to `top_shell`, black to `bottom_shell` and feet, and a Bordeaux marble texture to power/reset buttons, cartridge lip, port bezels and microSD insert. CAD meshes receive planar UV coordinates for the texture. Selectable camera views reveal the top, connections and internal boards.

Interaction: mouse drag, arrow keys when focused, and two-finger touch rotation. Single-finger touch remains available for scrolling. Reduced motion skips camera transitions; offscreen and hidden-page rendering pauses. The secondary viewer loads on approach. Failed 3D loading has a retry control.

## Asset provenance

The Bordeaux marble texture at `public/textures/bordeaux-marble.png` was created using built-in image_gen and copied into this project. Prompt: Square seamless PBR base-color texture of polished deep burgundy Bordeaux marble, rich wine red covering approximately 85%, fine irregular organic warm ivory and pale rose mineral veins; flat orthographic surface, evenly lit, no reflections, shading, edges, text, objects, perspective or watermark. Tiling was requested but is not certified.

Design references: https://www.analogue.co/pocket and Apple product-page spacing and typography. This site uses original copy and the user's console geometry, with no copied Analogue images or product claims.
