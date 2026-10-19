# The film

Ten paintings in sixty seconds, one continuous breath: a day and a year passing through the same painter's hand. Morning bamboo, cranes and high peaks, an autumn cascade and falling leaves, a golden river, a red sunset over a stone bridge, moonlight, and snow, after which the painting returns to bare paper leaving only the artist's seal.

- 1920x1080, 60 fps, 60 s. Picture and sound share one clock (`src/timeline.js`): 80 BPM, a bar = 3 s. Each painting holds two bars; every transition is centred on the bar line where its painting begins.
- Signature move: **ink bloom**. The opening paints itself onto bare paper (darkest ink first, blooming from seed points with a wet front); the ending reverses it (pale washes evaporate first, the darkest ink last) and only the seal remains.

## Shot list

| bars | time | scene | transition in | idea |
|---|---|---|---|---|
| 1-2 | 0-6 | s07 bamboo valley | bloom from paper (3.0 s) | the painting paints itself in; bamboo starts to sway |
| 3-4 | 6 | s01 cranes over the falls | mist veil (1.8 s) | river mist of s07 rises and becomes waterfall spray mist |
| 5-6 | 12 | s04 rope bridges | mist veil, faster drift (1.8 s) | cranes continue through the peaks |
| 7-8 | 18 | s09 floating peaks | cloud rise (2.0 s): camera rises through a cloud bank | above the clouds |
| 9-10 | 24 | s08 red cascade | zoom through spray (1.6 s): push into s09's waterfall, emerge in the cascade | strongest moment |
| 11-12 | 30 | s10 autumn ruins | wind wipe (1.6 s), leaves carried across | autumn |
| 13-14 | 36 | s02 golden river | handscroll pan (2.2 s): the painting continues to the right | golden hour |
| 15-16 | 42 | s05 stone bridge, red sun | sun match (2.0 s): the gold sun slides onto the red sun | sunset |
| 17-18 | 48 | s03 moon over the lake | dusk wash (2.2 s): ink bleeds down the wet sky | night |
| 19-20 | 54 | s06 snow temple | snow veil (2.2 s): snow thickens over the moonlit lake | winter |
| - | 56.7 | seal pressed | - | the painting is signed |
| - | 58-60 | paper | evaporate (1.8 s) | the painting returns to paper, the seal stays |

## Scene time window

A scene's local time `t = 0` is its shot start (the start of its incoming transition). It is visible from `t = 0` until its outgoing transition ends, about `t = 7.9`. Its composition should match the reference most closely around **t = 2-4**, and it must keep moving continuously for t in [-3, 14].

## Camera and overscan contracts with the transitions

Transitions offset scene cameras; the scenes must have painted content there (no card edges may ever show):

- **s04** (outgoing into the cloud rise): camera y goes to -260 at the end: needs ~300 px of extra painted content ABOVE the frame on z=1 cards (scaled by depth: a z=4 card moves 65 px).
- **s09** (incoming from the cloud rise): camera y starts at +260 and eases to 0: needs ~300 px extra BELOW the frame on z=1 cards.
- **s10** (outgoing into the scroll pan): camera x goes to +220: needs ~260 px extra on the RIGHT on z=1 cards.
- **s02** (incoming from the scroll pan): camera x starts at -220: needs ~260 px extra on the LEFT on z=1 cards.
- **s09 -> s08 spray**: the transition zooms into s09's waterfall (currently assumed at (330, 560)) and out of s08's cascade (assumed (700, 420)). Report the actual positions.
- **s02 -> s05 sun match**: report the sun centres (assumed s02 (1520, 330), s05 (1700, 345)).
- **s07 bloom**: report two seed points where the darkest ink mass sits (e.g. the bamboo culms and the right cliff).

Plus each scene's own camera move (keep within its overscan).

## Per-scene animation plan (a living painting, not a slideshow)

Nothing jitters, everything breathes. Speeds in docs/STYLE.md.

- **s07 bamboo valley**: bamboo sways (culms gently, leaves more, with gusts that travel across the grove), river mist flows downstream, mist banks drift between the peaks. Camera: slow push toward the valley (dolly 0 -> ~0.05) with a slight drift right.
- **s01 cranes over the falls**: the three cranes fly right and slightly up across the frame (wingbeats), waterfall falls with spray mist billowing at its base, pine sways, mist drifts across the far peaks and over the lake, lake reflections ripple. Camera: slow pan right following the cranes.
- **s04 rope bridges**: cranes fly; waterfall falls; mist rivers flow between the pillars; bridges sway very slightly; pine sways. Camera: slow tilt up (y 0 -> about -60) leading into the rise.
- **s09 floating peaks**: the sea of clouds rolls slowly; cranes glide; waterfall falls; wisps pass in front of distant peaks. Camera: settles downward after the rise (handled by the transition) then drifts slowly right.
- **s08 red cascade**: tiers of water falling, spray clouds billowing up, maples and pines swaying, a few red leaves drifting down. Camera: slow push toward the cascade.
- **s10 autumn ruins**: red maple leaves falling across the frame (some near and blurred), maple and pine sway, waterfalls fall, mist drifts around the towers and over the crater lake. Camera: slow pan right (prepares the scroll).
- **s02 golden river**: the river glitters and flows, golden mist drifts through the valley, the sun glow breathes, gold cloud bands drift. Camera: continues the scroll's motion, decelerating to a slow drift.
- **s05 stone bridge, red sun**: water reflections ripple and shimmer, the red sun sinks slightly, mist drifts along the far shore, maple and pine sway. Camera: slow push-in.
- **s03 moon over the lake**: clouds drift across and partly veil the moon, the moon glitter column shimmers, mist creeps over the water, pine sways. Camera: slow push toward the moon.
- **s06 snow temple**: snow falls (several depths), clouds roll in the valley, a few snow puffs fall from pine branches. Camera: very slow pull back.
