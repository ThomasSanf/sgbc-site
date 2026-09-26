# SGBC product website

Next.js App Router + TypeScript + Three.js. Product copy is based on the SGBC Rev C engineering documentation. The site presents a prototype, with no fabricated pricing, launch date, checkout, or mailing-list storage.

## Run

Use Node.js 22.13 or later and pnpm.

On this Windows computer, run `.\start-website.cmd` from PowerShell (or double-click
it). It finds the bundled Node/pnpm runtime even when they are missing from PATH.
Open http://127.0.0.1:3000 and keep the terminal open. Press Ctrl+C to stop.

- `pnpm install`
- `pnpm dev`
- `pnpm build` creates a static export in `out/`.

The registered private Site is recorded in `.openai/hosting.json`.

## Current motherboard and visual design

The dark, typography-led layout takes visual direction from basement.studio:
a large interactive product stage, thin rules, and orange accents. The original
console assembly and its cutaway remain available under Design.

`public/models/sgbc-revc-it6263.glb` is the separate current IT6263 Rev C PCB,
copied unchanged from `../gb-fpga-core/hardware/revC_it6263_jlc_rework/outputs/console_revC_current.glb`.
The standalone Motherboard section has been removed from the page; the GLB remains
in the repository. `public/models/pcb-revision.json` records its SHA-256
and source. Some component bodies are nominal substitutes. This is an engineering
review model, not proof of hardware operation or fit in the earlier enclosure.

Tailwind scans only `app`, `components`, and `lib`. Keep the explicit `@source`
paths in `app/globals.css`: automatic scanning of large CAD binaries caused a
memory allocation failure. Models load on approach to their section; offscreen
viewers do not render frames. No new external assets or fonts are required.

## Product model

`public/models/sgbc-revc.glb` is derived from the Rev C CAD export at `../gb-fpga-core/hardware/revC/enclosure/output/SGBC_RevC_colored.glb`. The website variant brings the HDMI and USB-C faces to 0.10 mm proud of the rear panel and replaces the oversized cutouts with contours offset 0.25 mm from each connector face. The shell now covers the exposed board below the connectors. This is a presentation design change: PCB layouts, engineering STEP and printable enclosure files remain unchanged. The Three.js viewer applies darker NES-inspired warm gray (#98988f) to `top_shell`, black to `bottom_shell` and feet, and solid Bordeaux (#592330) to power/reset buttons, cartridge lip, port bezels and microSD insert. CAD meshes receive lighting normals for smooth solid finishes. Selectable camera views reveal the top, connections and internal boards.

Rebuild the model using `../.tools/case-env/Scripts/python.exe scripts/fit-rear-ports.py` (add `--render` for a rear-view CAD preview). It reads the original CAD sources, regenerates both shells, moves the two connector models by reference, and checks closed shell solids and the material around each opening. `public/models/rear-port-fit.json` records the geometry and output hash. `node scripts/verify-model.mjs` verifies the exported GLB and its connector positions. Port placement in a fabrication revision would require a corresponding electrical and mechanical fit update.

The inside view is a roof cutaway. It retains the complete controls assembly: the PCB, switch mechanisms, equal-height outer caps, contact tips, retainer, LED spacers and fasteners. A separate cutaway-only mesh preserves the four PCB posts and two retainer posts extracted from the actual lid; it is hidden with the roof installed to avoid duplicate surfaces. Power and Reset now use the same KSC623G LFG switch and identical rigid cap/plunger and TPU tip parts from the routed controls C2 hardware. An LTC2950 controller on that board toggles power independently of the FPGA. Both released cap tops remain at Z=36.9 mm. Add `--render --controls` when rebuilding for a controls cutaway preview.

## Cartridge carrier C2 hardware

The viewer imports the **actual routed 64 x 13.6 x 1.6 mm C2 KiCad carrier**, with its
native FFC connector and capacitors. The new printed socket clamp, stock mounting
tabs and formed ground straps come from the hardware CAD. The former simplified
64 x 10.4 mm presentation PCB is superseded.

`scripts/cartridge_loader.py` verifies that hardware electrical, mechanical and
case reports identify the same current PCB hash. It retains all native carrier
meshes, adds the actual cradle only for the roof cutaway and checks both fitted
website shells against the complete nominal cartridge shell and internal PCB.
The hardware has 936 sampled insertion checks; the website shells add 144 checks.
Results are in `outputs/cartridge-fit/hardware-c2/fit-check.json`.

The nominal shell rim seats at Z=26.2 mm, 1 mm above the carrier. The lower shell
recess surrounds the socket instead of treating the cartridge as a bare blade.
Socket engagement/contact wipe, exact OEM shell dimensions, printed retention and
prototype electrical readback still require physical samples.

Regenerate hardware CAD and `enclosure/output/SGBC_RevC_colored.glb` first, then run
`scripts/fit-rear-ports.py` and `node scripts/verify-model.mjs`. The rear port changes
remain a website variant. Current cartridge fabrication and mounting files are in
`../gb-fpga-core/hardware/revC/outputs/SGBC_carrier_C2_hardware_review.zip`.

The model metadata also binds controls C2 electrical, case and native switch-identity
checks to the current PCB hash. `verify-model.mjs` compares both translated cap
and tip meshes and confirms identical native switch geometry from the hardware
report. The PCB review package is
`../gb-fpga-core/hardware/revC/outputs/SGBC_controls_C2_identical_buttons_review.zip`.

## Hero interaction and preorder

The hero combines the headline, supporting copy, preorder action, and console in
one responsive composition. Its Three.js instance uses `interaction="cursor"`:
a passive canvas with no pointer events, no keyboard focus, and no OrbitControls.
Mouse position over the whole hero produces a bounded, damped tilt around the
center of the console. It returns to neutral on pointer leave or window blur.
On mobile layouts (up to 760px), coarse pointers, or devices without hover,
page scrolling rotates the console horizontally with a slight tilt as the hero
leaves the viewport. Scrolling back reverses the rotation. Passive listeners
leave touch scrolling native, and layout is read at most once per animation frame
after scrolling or resizing. Reduced motion keeps the console still. The separate
Design viewer retains its interactive rotation and camera tabs.

Preorder currently opens an accessible “Preorders opening soon” dialog. No
checkout, payment, reservation, or mailing-list submission is implied.
