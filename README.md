# SGBC product website

Next.js App Router + TypeScript + Three.js, with a Google-protected store admin, persistent database, and ECPay hosted credit-card preorders. Product copy is based on the SGBC Rev C engineering documentation. Checkout stays closed until live merchant credentials, a confirmed shipping fee, and the store's availability setting are ready.

## Run

Use Node.js 22.13 or later and pnpm.

On this Windows computer, run `.\start-website.cmd` from PowerShell (or double-click
it). It finds the bundled Node/pnpm runtime even when they are missing from PATH.
Open http://127.0.0.1:3000 and keep the terminal open. Press Ctrl+C to stop.

- `pnpm install`
- `pnpm dev`
- `pnpm build` builds the Next.js server and static storefront.
- `pnpm start` serves the production build.
- `pnpm admin:setup`, then `pnpm db:migrate`, prepares local admin configuration and storage.
- `pnpm test` runs backend and security tests against disposable databases.

The active deployment is the existing GitHub/Vercel Next.js project. The older `.openai/hosting.json` is historical; its static hosting configuration cannot run the new backend. Unused Vinext/Cloudflare starter tooling has been removed.

## Store admin

Open `/admin/`. Google sign-in is restricted to verified emails in the server's
`ADMIN_EMAILS` allowlist. There is no public signup, password fallback, or local
authentication bypass. All data endpoints check authorization on the server.

The dashboard manages products, stock, paid ECPay orders, legacy unpaid reservations,
fulfillment, and an activity log. Checkout and
public reservations are closed by default. Local development uses SQLite; Vercel
requires a persistent hosted libSQL/Turso database. See
[the complete setup guide](docs/admin-setup.md) for Google OAuth, database,
deployment and API details, and [ECPay setup](docs/ecpay-setup.md) for sandbox testing,
live activation, shipping, payment reconciliation, and current limitations.

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

Rebuild the model using `../.tools/case-env/Scripts/python.exe scripts/fit-rear-ports.py` (add `--render` for a rear-view CAD preview). The exporter reads the original CAD surfaces and stores their outward normals in the GLB. The flat panels keep a constant normal, the rounded corners follow the design curves, and sharp openings keep separate normals on either side. The web viewers use these normals directly.

The build also regenerates both shells, moves the two connector models by reference, and checks closed shell solids and the material around each opening. `public/models/rear-port-fit.json` records the geometry and output hash. Run `node scripts/verify-model.mjs` to verify the exported shading, connector positions, and assembly. Port placement in a fabrication revision would require a corresponding electrical and mechanical fit update.

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
Design viewer supports one-finger touch dragging, mouse dragging, keyboard
rotation, and camera tabs. Its canvas uses `touch-action: none` so vertical and
horizontal drags rotate the model; swipes outside that canvas scroll the page.
A mobile “Drag to rotate” hint makes this interaction visible.

Preorder opens a bilingual, accessible dialog with the unit price and the disclosure
that no shipping date has been announced. Once checkout is configured and enabled,
it collects contact details, a Taiwan delivery address and quantity, calculates
delivery per unit, and posts a server-signed order to ECPay's hosted card page.
Card details never pass through SGBC. Server-verified payments update the order and
allocation exactly once. Browser redirects do not confirm payment. Sandbox orders
are labeled, excluded from revenue, and blocked from fulfillment.

An explicit `PUBLIC_ECPAY_SANDBOX=true` deployment opens a clearly labeled public
test checkout using ECPay's test credentials and a dedicated test allocation. Run
`node --conditions=react-server --import tsx scripts/setup-ecpay-sandbox.ts` once
against the target database first. Real inventory and availability stay unchanged;
turn off the flag and redeploy to close the demo. See the ECPay guide above.

## Languages

The header switches between English and Taiwan Traditional Chinese (`zh-TW`).
On desktop it replaces the Rev C link; on mobile it sits immediately before
Preorder. Copy lives in `lib/site-copy.ts`, including dialogs and viewer labels.
The browser remembers the choice in `localStorage` under `sgbc-language`; if
storage is unavailable, switching still works for the current visit. The document
language, title, and description follow the selected language. Switching does not
remount the Three.js scenes or reset their selected viewing angle.
