# Style guide: shan shui ink on rice paper

The ten references (`ref/01.webp` .. `ref/10.webp`) are one series: Chinese ink-wash landscapes on warm rice paper, monochrome ink with sparing vermilion, deep atmospheric mist. The bar is that a still frame of the code painting could sit next to its reference and read as the same painter. Look at the references at full size often.

## Measured palette (sRGB 0-255)

| token | value | where |
|---|---|---|
| paper | 239, 231, 220 | refs 01, 04, 05, 08, 10 (brightest 8 % average) |
| paper, cool/grey | 237, 228, 215 / 240, 234, 226 | 03 (night) / 06 (snow) |
| paper, golden | 250, 233, 203, sky up to 251,234,202 with a pale sun 245,215,150 | 02 |
| ink black | 8-13, 7-11, 4-8 (warm black) | darkest 1 % in every ref |
| luminance percentiles | p10 66-118, median 180-219, p90 224-235 | paper dominates: most of the frame is light |
| red accent (mixed with ink) | 145-171, 76-110, 61-92 avg; pure strokes ~ 185-205, 45-65, 35-50 | pavilion columns, maple clusters, sun in 05 |

Tokens live in `src/lib/brush.js` (`PAPER`, `INK`, `VERMILION`, `MAPLE`, `GOLD`, `tone(v)`).

## How these paintings are built

1. **Three distances.** A near mass (cliff, pine, rocks) in the darkest, crispest ink on one side; a midground of peaks/islands in mid greys; far ranges as pale, soft silhouettes. Mist (paper colour) separates every depth plane - the base of each mass dissolves into white.
2. **Atmospheric value ladder.** Near ink reaches true black (rgb ~10) with sharp detail; midground tops at ~35-55 % tone (`tone(0.35..0.55)`); far ranges 65-85 % tone with almost no internal detail. Contrast and edge sharpness fall with distance.
3. **Edges carry the drawing.** Rock and peak tops have a darker, slightly ragged contour (dry brush) and the tone fades downward into mist. Inside masses: vertical cun strokes (fissures on granite pillars), lighter planes left bare, dark moss dots (`dots`) along ridges and ledges.
4. **Trees are vocabulary, not noise.** Hero pines: gnarled dark trunk with bark texture, near-horizontal branches, foliage as flat layered pads made of radiating needle fans (dark, dense centres, lighter fringes). Ridge trees: small conifer silhouettes (vertical dabs/tiers) crowning tops and ledges, getting paler and simpler with distance.
5. **Paper is always present.** Never pure white, never flat: the fibre texture shows through washes and ink. Mist and sky are the paper itself.
6. **Red is sparing (< 2 % of pixels).** Vermilion columns on pavilions; small maple clusters (dots/leaf dabs) near the main cliff. Ref 08 and 10 have more red (1.3-1.6 %).
7. **Water** is mostly paper with faint horizontal streaks and soft mirrored reflections of islands/peaks broken by ripples; moonlight/sun make a glitter column.

## What reads as fake (avoid)

- Smooth vector gradients or shapes with perfectly clean edges and no paper texture.
- Regular repetition (identical trees in a row, evenly spaced peaks), symmetric shapes.
- Mid-grey everywhere: the references have real blacks AND large bare paper areas.
- Saturated colours, glow/bloom, lens effects, outlines around everything.
- Noise that has no brush logic (fbm blobs that don't read as strokes, rocks or foliage).

## Motion (the film is a "living painting")

Everything breathes slowly; nothing jitters.
- Mist: drifts 5-25 px/s, evolves in shape (3D noise with time), parallaxes with depth.
- Pines/bamboo: wind sway 1-5 px at the tips, 0.15-0.35 Hz, plus faint flutter; bamboo leaves a little livelier.
- Water: slow streak drift, reflections rippling (amp 1.5-4 px), glitter twinkle.
- Waterfalls: water streaks fall at ~150-400 px/s (scaled by size/distance), spray mist billows at the base.
- Cranes: wingbeat ~0.8-1.1 Hz, slow glide arcs, gentle bob; they cross ~40-90 px/s.
- Falling maple leaves: 40-110 px/s with flutter and tumble; snow 20-60 px/s with drift.
- Camera: slow eased push-ins / lateral drifts, 8-35 px/s at the picture plane, dolly <= ~0.08 per scene.

## Per-reference element map (design px, 1920x1080, approximate)

**01 Cranes over the falls.** Hero pine from the left edge: trunk rises from (0-180, 520) curving up and right, canopy pads across x 0-850, y 20-380, a long branch reaching right to x ~850 at y 230-300. Red two-tier pavilion on the cliff top (200-350, 355-470). Left cliff mass x 0-680 from y 420 to the bottom, waterfall x 470-590, y 590-830 dropping into mist. Red maple clusters (360-470, 420-500) and (0-130, 590-720). Three cranes flying right: (1070-1200, 215-300), (1220-1350, 210-280), (1370-1490, 115-200). Right: layered misty peaks x 1300-1920, y 230-800. Mid hills x 480-1300, y 480-700 in mist. Lake y 790-1080 with islands (1000-1360, 780-830) and (1550-1870, 800-890) and their reflections.

**02 Golden river.** Warm golden paper, pale sun (1520, 330) r ~45 low over far ridges, glow and gold cloud bands across the top right. Pine top-left (0-380, 60-560). Left cliffs x 0-620, y 380-1080 dark. Red maple (300-460, 510-640). Central peaks (380-1000, 70-560) layered in mist. A winding river glowing gold from the sun down through the valley (900-1720, 500-1000) with islands (1000-1240, 770-870), (1340-1560, 760-830). Pavilion (1640-1710, 340-400) on a right cliff (1550-1780, 380-570).

**03 Moon over the lake.** Night: grey-washed sky with soft dark cloud bands, full moon (1325, 225) r ~85 with faint maria and a halo. Pine top-left (0-560, 80-430). Pavilion (225-405, 350-460) on the left cliff (0-900, 400-1080). Red maples (390-470, 420-480), (150-310, 640-720). Peaks centre (560-1050, 300-560) and right (1380-1920, 160-560). Islands (900-1250, 650-730), (1520-1870, 650-730). Lake y 640-1080 with a long moon-glitter column at x ~1320 and island reflections.

**04 Rope bridges.** Dense Huangshan pillar peaks filling the frame in mist. Waterfall (370-470, 520-800). Rope bridges: long sagging one (910-1420, 450-520), a small upper one (900-1000, 320-370), a lower one (780-910, 770-830). Four cranes (1040-1460, 60-240). Pine top-right (1380-1920, 70-320) leaning left. Pavilion (1590-1710, 330-430). Red maples (1700-1800, 360-430), (1580-1680, 760-830). Right cliff mass (1380-1920, 380-1080).

**05 Stone arch bridge.** Pine left (0-450, 50-560) with red maple (0-370, 380-560). Three-arch stone bridge (270-830, 510-700) with balustrade, reflected in still water. Island with pavilion (1030-1680, 470-680), pavilion (1260-1400, 470-560). Small red sun (1700, 345) r ~30 with a faint red reflection. Far soft mountains (300-1150, 120-420) and (1150-1920, 300-600). Water y 620-1080. Small island right (1750-1920, 640-700).

**06 Snow temple.** Cool white. Snow-laden pines left (0-520, 0-450). Temple halls with snowy roofs and red columns (220-430, 250-370), a second pavilion (720-820, 290-350). Frozen waterfalls with icicles (530-700, 450-900), (850-930, 600-870). Snowy cliffs x 0-1150, y 300-1080: dark rock showing under white snow caps. Sea of clouds to the right and bottom; snowy peaks right (950-1920, 90-950).

**07 Bamboo valley.** Bamboo grove on the left (0-1000, full height): tall dark culms with nodes, sharp leaf clusters, some leaves over the sky. Rocks bottom-left (0-650, 690-1080). Right cliffs (1440-1920, full height) with a red gate/pavilion (1540-1720, 330-420). Misty peaks centre (850-1500, 100-650). River (700-1600, 720-1000). Bamboo bottom-right (1600-1920, 820-1080).

**08 Red cascade.** Multi-tier waterfall from the top centre-left down to the bottom (400-1000, 0-1000) with lots of white spray. Cliffs left (0-560, 100-1080) heavy with red maples and pines. Right: misty pillar peaks (1100-1920, 60-900).

**09 Floating peaks.** Pine top-left (0-430, 30-280). Main temple (150-370, 280-420) on the left cliff (0-650, 260-1080) with a waterfall (290-370, 450-650). Many pillar peaks floating in a sea of clouds, most crowned with small pavilions; small stone arch bridges between peaks (900-1050, 520-600), (1230-1330, 470-560), (1400-1640, 410-500). Four cranes (1100-1500, 120-280).

**10 Autumn ruins.** Pine top-left (0-500, 0-330). Red maple left (0-350, 480-830) shedding leaves; falling red maple leaves across (300-1060, 500-1080), some large and blurred near camera. Left cliff (0-560, 280-1080). Ruined stone towers on peaks (1270-1370, 50-170), (730-790, 150-210), (1110-1150, 190-230). Crater lake centre (880-1440, 590-700). Waterfalls (720-760, 400-540), (1360-1440, 750-950), (1600-1630, 290-360).
