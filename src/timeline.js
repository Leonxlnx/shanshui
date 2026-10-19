// One clock for picture and sound. 80 BPM, 4/4: a beat is 0.75 s (45 frames
// at 60 fps), a bar is 3 s. Each painting holds two bars; every transition is
// centred on the bar line where its painting begins.

export const BPM = 80;
export const FPS = 60;
export const BEAT = 60 / BPM;          // 0.75 s
export const BAR = 4 * BEAT;           // 3 s
export const DURATION = 60;            // 20 bars
export const bt = (bar, beat = 0) => (bar - 1) * BAR + beat * BEAT;   // bar is 1-based

// A transition of `dur` seconds centred on the downbeat of `bar`.
const around = (bar, dur) => bt(bar) - dur / 2;

// '@paper' is bare paper. in = transition from the previous shot (start..start+dur).
// t0 = scene-local time at the shot's start (scenes are valid for local t in [-3, 14]).
export const SHOTS = [
  { scene: '@paper', start: -1 },
  { scene: 's07', start: 0.0, t0: 0, in: { type: 'bloom', dur: 3.0, c: [185, 330], c2: [1485, 465] } },                    // bars 1-2   bamboo valley, painted in from bare paper
  { scene: 's01', start: around(3, 1.8), t0: 0, in: { type: 'mist', dur: 1.8 } },          // bars 3-4   cranes over the falls
  { scene: 's04', start: around(5, 1.8), t0: 0, in: { type: 'mist', dur: 1.8, k: [0.74, 0.0, 1.2, 1.8], k2: [1, 0, 0, 0] } }, // bars 5-6 rope bridges (mist sweeps across)
  { scene: 's09', start: around(7, 2.0), t0: 0, in: { type: 'cloudrise', dur: 2.0 } },     // bars 7-8   floating peaks
  { scene: 's08', start: around(9, 1.6), t0: 0, in: { type: 'spray', dur: 1.6, c: [308, 672], c2: [640, 270] } },         // bars 9-10  red cascade
  { scene: 's10', start: around(11, 2.0), t0: 0, in: { type: 'wind', dur: 2.0, ease: 'sine' } }, // bars 11-12 autumn ruins (a leaf gust carries the seam)
  { scene: 's02', start: around(13, 2.2), t0: 0, in: { type: 'scroll', dur: 2.2 } },       // bars 13-14 golden river
  { scene: 's05', start: around(15, 2.0), t0: 0, in: { type: 'sunmatch', dur: 2.0, c: [1349, 308], c2: [1742, 353] } },     // bars 15-16 stone bridge, red sun
  { scene: 's03', start: around(17, 2.2), t0: 0, in: { type: 'dusk', dur: 2.2 } },         // bars 17-18 moon over the lake
  { scene: 's06', start: around(19, 2.2), t0: 0, in: { type: 'snow', dur: 2.2 } },         // bars 19-20 snow temple
  { scene: '@paper', start: 58.0, in: { type: 'evaporate', dur: 1.8 } },                    // the painting returns to paper
];

// Named moments the sound design hangs on.
export const CUE = {
  gust: bt(11) - 1.35,      // the leaf gust starts just before the wind wipe (28.65 s)
  seal: bt(19, 3.6),        // the seal is pressed onto the snow painting (56.7 s)
  evaporate: 58.0,
};
