# Engine guide

Everything in the film is painted by code: WebGL2 for procedural fields and compositing, Canvas2D for brushwork. No image assets are ever loaded by the renderer (the `ref/` images are only used by the comparison tools).

## Layout

```
src/engine/   gl.js (WebGL helpers), glsl.js (shared GLSL: noise, ink), rng.js (seeded RNG + JS noise), engine.js (compositor)
src/lib/      element generators (brush.js, inkfx.js, then pine/rock/peaks/atmos/water/architecture/fauna/flora ...)
src/scenes/   the ten film scenes s01..s10 (+ index.js registry)
src/lab/      scratch/test scenes for element work (loaded by path, not registered)
src/film.js   the 60 s timeline: shot order, transitions, grade
tools/        still.mjs (renders + comparisons), daemon.mjs (warm GPU renderer), render.mjs (film -> mp4)
docs/         this file, STYLE.md
ref/          the ten reference paintings 01..10.webp (comparison only, never rendered)
out/          renders (gitignored)
```

## Coordinates and the camera

- Design space is **1920 x 1080 px, origin top-left, y down**, independent of render scale. The reference images (1672 px wide) map onto it by x1.1483.
- Every layer is a flat card at a **depth `z`**: `z = 1` is the picture plane (nearest foreground), larger is farther (`z = 2..4` midground, `6..15` far ranges), `1e5` = sky/paper (never moves).
- A layer's `rect = [x, y, w, h]` is where it sits **at rest** (camera at default), in design px. At rest, what you place is exactly what you see.
- Camera `{ x, y, dolly, zoom, roll }` (all default 0 / zoom 1). Projection of a rest point `P` on a card at depth `z`:
  `screen = C + ((P - C) * z - [x, y]) / (z - dolly) * zoom`, then `roll` (radians) around the centre `C`.
  - `x, y` pan: a `z = 1` card shifts by exactly `-x` px; a `z = 4` card by `-x/4` (parallax).
  - `dolly` moves the camera forward: a `z = 1` card scales by `1/(1 - dolly)`, far cards barely change. Keep `dolly < 0.5` for `z = 1` cards.
  - `zoom` is a lens zoom: scales everything equally about the centre.
- Because cards move, **overscan**: make near cards extend 8-15 % past every frame edge they touch, more if the scene's camera pans. Shader layers default to a rect of `[-480, -270, 2880, 1620]`.

## Scene module contract

```js
export default {
  id: 's03', title: 'Moon over the lake', ref: '03',   // ref = which reference image the tools compare against
  build(api) {                                          // may be async; runs once
    const layers = [ /* back to front */ ];
    return {
      layers,
      camera: (t) => ({ x: 0, y: 0, dolly: 0.02 * t, zoom: 1, roll: 0 }),   // optional
      grade: { exposure: 1, contrast: 1, saturation: 1, paper: 0.045, tint: [1,1,1], vignette: 0.1 }, // optional, object or fn(t)
      update: (t) => {},                                // optional per-frame hook
      meta: { clear: [0.937, 0.906, 0.863] },           // optional clear colour (0..1 rgb)
    };
  },
};
```

**Time contract.** `t` is scene-local seconds. The film shows each scene for ~6 s, but transitions overlap neighbouring scenes, so a scene must render correctly and keep moving smoothly for **t in [-3, 14]**. Animation is a pure function of `t` (no state carried between frames, no `Math.random`, no `Date`). Use seeded `api.rng(seed)` / `api.noise(seed)` at build time.

## The `api` object (passed to build)

| member | what it does |
|---|---|
| `api.W, api.H` | 1920, 1080 |
| `api.rng(seed)` | seeded RNG: `r()`, `r.range(a,b)`, `r.int(a,b)`, `r.pick(arr)`, `r.chance(p)`, `r.gauss(mu,s)`, `r.fork(salt)` |
| `api.noise(seed)` | JS simplex: `n2(x,y)`, `n3(x,y,z)` in [-1,1], `fbm2(x,y,oct)`, `ridge2(x,y,oct)` |
| `api.bakeCanvas(w, h, draw, {scale=1})` | Canvas2D bake once; `draw(ctx, {w,h,pw,ph,k})` draws in design px (ctx is pre-scaled). `scale` > 1 bakes extra pixel density for cards the camera pushes into (e.g. 1.25-1.5 for z=1 cards with dolly). Returns a texture source `{tex, w, h, pw, ph}` |
| `api.bakeShader(w, h, glsl, {scale, uniforms})` | GLSL bake once; `glsl` defines `vec4 shade(vec2 p, vec2 uv)` returning **premultiplied** rgba, `p` in [0,w]x[0,h] design px (y down). All shared GLSL is available (see below). Extra `uniforms` (numbers, arrays, texture sources) are set by name - declare them in your GLSL |
| `api.processTex(src, glsl, {uniforms})` | GLSL pass over an existing texture: your `shade(p, uv)` can `texture(uSrc, uv)` (premultiplied) and use `uTexel` (1/pixel size) |
| `api.texture(canvas)` | wrap an OffscreenCanvas you drew yourself as a texture source |
| `api.tex(src, opts)` | **texture card** layer |
| `api.shader(glsl, opts)` | **procedural card** drawn every frame: `vec4 shade(vec2 p, vec2 uv)` -> premultiplied rgba, `p` = rest-space design px at that depth (so noise sticks to the world and parallaxes correctly), `uv` 0..1 over the rect |
| `api.canvas(draw, opts)` | **Canvas2D card redrawn every frame**: `draw(ctx, t, layer)` in rest-space design px (cranes, falling leaves, snow). Keep its `rect` tight - it is uploaded every frame |

### Layer options (all layer kinds)

- `rect: [x, y, w, h]` (rest space, design px), `z: depth` (default 1).
- `opacity: number | (t) => number`, `visible: (t) => bool`.
- `blend: 'normal' | 'multiply' | 'screen' | 'add'` (premultiplied; `multiply` darkens like ink over paper).
- `update: (t, layer) => {}` mutate the layer per frame (e.g. `layer.rect = ...`).
- `name` for debugging.

Texture/canvas cards also take:
- `tint: [r, g, b, amount]` multiply tint (0..1).
- `sway: { amp: px, freq: Hz, scale: px, power, anchor: [x, y], radius: px, bias }` - wind displacement that grows with distance from `anchor` (e.g. a trunk base): `amp` is the max displacement in px at `radius` away, `scale` the spatial size of the gust pattern, `power` the falloff curve (1.5-2.5 for trees). Typical pine: `amp 3-6, freq 0.15-0.3`. Leave transparent margin around the card so displaced pixels are not clipped.
- `reflect: { y, strength, fade, smear, amp, wavelength, speed, breakup, tint, height }` - draws a mirrored, rippled copy of the card below its waterline `y` (rest space) before the card itself. `strength` 0..1 opacity at the waterline, `fade` px over which it decays, `smear` vertical blur px, `amp` ripple displacement px, `wavelength` ripple size px, `speed`, `breakup` 0..1 bright horizontal streaks erasing the reflection, `tint` rgb multiply. Can also be `(t) => ({...})`.

Shader layers also take:
- `uniforms: { name: value | (t) => value }` (declare them in GLSL), `textures: { name: textureSource }` (declare `uniform sampler2D name;`).

### GLSL available in every shader / bake

Uniforms in layers: `uTime` (scene seconds), `uCam` (x, y, dolly, zoom), `uRS` (render scale), `uDesign` (1920,1080), `uOpacity`, `uRect`.
Bakes: `uSize` (w, h).

Functions (`src/engine/glsl.js`):
- hashes `hash11, hash12, hash22, hash13`; value noise `vnoise(vec2)` [0,1]
- simplex `snoise(vec2)`, `snoise3(vec3)` [-1,1]
- `fbm(vec2, int oct)`, `fbm3(vec3, int oct)` ~[-1,1]; `ridged(vec2, int oct)` [0,1]
- `streaks(vec2 p, vec2 dir, float stretch, int oct)` anisotropic noise (brush texture, water streaks, cun strokes)
- `worley(vec2)` cellular distance
- `luma(vec3)`, `paperField(vec2 px)`, constants `INK_BLACK`, `VERMILION`

Return **premultiplied** colour: `vec4(rgb * a, a)`.

### Shared JS libraries

- `src/lib/brush.js`: palette tokens (`PAPER`, `INK`, `VERMILION`, `MAPLE`, `GOLD` ...), `tone(v)` (0 = ink black .. 1 = paper), `rgba(c, a)`, `inkCss(v, a)`, `smoothPath`, `stroke` (pressure-profiled filled stroke), `dryStroke` (bristle dry-brush), `blob`, `dots` (moss dots), `wash` (soft wash with wet rim), `noisePattern`, `granulate` (erode with paper grain), `gradientFill`.
- `src/lib/inkfx.js`: `inkify(api, src, {edge, granulation, bleed})` GPU pass that turns a clean Canvas2D bake into ink soaked into paper (wet-edge pooling, granulation, bleed halo). Use on most brushwork bakes.

## Global post (applied to every frame, by the film or still tool)

Paper fibre texture (static, screen space; stronger in ink), grade (`exposure, contrast` (pivot 0.62), `saturation, tint`), optional `lift` toward a colour, vignette, TPDF dither (prevents banding in soft mist gradients). Scenes paint their own paper background as their first layer.

## Tools

The warm render daemon should already be running (`node tools/daemon.mjs`, port 7781). `still.mjs` uses it automatically (~2-3 s per call); without it, each call launches Chrome (~20 s).

```
node tools/still.mjs --scene s03 --t 2 --out out/s03/a.png
     --compare out/s03/cmp.png            reference (top) over render (bottom), 960 px wide each
     --side out/s03/side.png              reference | render
     --crop 0,300,700,500:out/s03/c1.png  zoomed region (design px) ref | render (repeatable)
     --sheet 0,2,4,6,8:out/s03/sheet.png  contact sheet over time
     --ref 07                             compare against another reference (default: the scene's `ref`)
     --scale 0.5                          render density (faster); --samples 4 sub-frame motion blur
     --width 640                          output width per image (smaller images = cheaper to look at; use 640)
     --grade '{"ink":[0.5,0.6,1.6,0]}'  force grade values for an A/B test
```

`--scene` also takes a path under `src/` without extension, e.g. `--scene lab/pine-01` for `src/lab/pine-01.js`. Lab scenes are never registered, so many agents can work at once without touching shared files.

Look at your outputs with the Read tool (it shows images). Compare crops at 1:1 - that is where painterly quality is won or lost.

## Budgets

- Build (all bakes) at scale 1: aim < 4 s per scene; a single element bake < 1.5 s.
- Per-frame render: < 40 ms at 1920x1080 on the target GPU (Radeon 780M iGPU). Shader layers: keep fbm octaves sensible (<= 6), avoid more than ~6 full-screen procedural layers.
- Texture memory: bake at the size you need; cards wider than ~4000 px or more than ~30 cards per scene need a reason.

## Pitfalls

- Premultiplied alpha everywhere. Canvas bakes are premultiplied on upload automatically.
- `canvas` layers are redrawn and re-uploaded every frame: tight rects, no expensive filters at large sizes.
- Never use `Math.random()`, `Date.now()` or `performance.now()` in scene code.
- `ctx.filter = 'blur(..)'` in Canvas2D is fine at bake time (it is in design px * density).
- The engine is shared: do not edit `src/engine/*` or `src/lib/brush.js` / `inkfx.js` during parallel work. If you hit an engine bug, work around it locally and report it.
