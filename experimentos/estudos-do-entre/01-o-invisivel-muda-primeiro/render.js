const { createCanvas, GlobalFonts, ImageData } = require('@napi-rs/canvas');
const fs = require('node:fs');
const path = require('node:path');

// Estudos do Entre · 01
// Deterministic seed: September equinox, 2026-09-23T00:05Z.
const SEED = 202609230005;
const SW = 270;
const SH = 480;
const SCALE = 4;
const W = SW * SCALE;
const H = SH * SCALE;
const ITERATIONS = 2100;

const fontFiles = [
  ['/usr/share/fonts/opentype/urw-base35/C059-Roman.otf', 'C059'],
  ['/usr/share/fonts/opentype/urw-base35/C059-Italic.otf', 'C059 Italic'],
  ['/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf', 'Nimbus Sans'],
];
for (const [fontPath, family] of fontFiles) {
  if (fs.existsSync(fontPath)) GlobalFonts.registerFromPath(fontPath, family);
}

let rngState = SEED >>> 0;
function random() {
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  return (rngState >>> 0) / 4294967296;
}

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

let a = new Float32Array(SW * SH);
let b = new Float32Array(SW * SH);
let nextA = new Float32Array(SW * SH);
let nextB = new Float32Array(SW * SH);
a.fill(1);

function seedDisc(cx, cy, radius, strength = 1) {
  const r2 = radius * radius;
  const x0 = Math.max(1, Math.floor(cx - radius));
  const x1 = Math.min(SW - 2, Math.ceil(cx + radius));
  const y0 = Math.max(1, Math.floor(cy - radius));
  const y1 = Math.min(SH - 2, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        const i = y * SW + x;
        const softness = 1 - Math.sqrt(dx * dx + dy * dy) / radius;
        b[i] = Math.max(b[i], strength * (0.58 + softness * 0.42));
        a[i] = 1 - b[i] * 0.58;
      }
    }
  }
}

// Two fields begin apart. Small satellite seeds make their meeting asymmetric
// and ensure the final topology belongs to this timestamp alone.
seedDisc(SW * 0.34, SH * 0.42, 19, 0.98);
seedDisc(SW * 0.66, SH * 0.56, 20, 0.98);
for (let i = 0; i < 42; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const x = SW * 0.5 + side * (8 + random() * 76);
  const y = SH * (0.22 + random() * 0.55);
  seedDisc(x, y, 2.2 + random() * 4.8, 0.72 + random() * 0.28);
}

function step(iteration) {
  const phase = iteration / ITERATIONS;
  for (let y = 1; y < SH - 1; y++) {
    const vertical = y / SH;
    for (let x = 1; x < SW - 1; x++) {
      const i = y * SW + x;
      const av = a[i];
      const bv = b[i];
      const lapA =
        -av +
        0.2 * (a[i - 1] + a[i + 1] + a[i - SW] + a[i + SW]) +
        0.05 * (a[i - SW - 1] + a[i - SW + 1] + a[i + SW - 1] + a[i + SW + 1]);
      const lapB =
        -bv +
        0.2 * (b[i - 1] + b[i + 1] + b[i - SW] + b[i + SW]) +
        0.05 * (b[i - SW - 1] + b[i - SW + 1] + b[i + SW - 1] + b[i + SW + 1]);

      const nx = x / SW - 0.5;
      const liminalBand = Math.exp(-nx * nx * 18);
      const feed = 0.0526 + vertical * 0.0020 + liminalBand * 0.0014;
      const kill = 0.0605 + (1 - vertical) * 0.0017 - liminalBand * 0.00065 + phase * 0.00028;
      const reaction = av * bv * bv;
      nextA[i] = clamp(av + (0.16 * lapA - reaction + feed * (1 - av)));
      nextB[i] = clamp(bv + (0.08 * lapB + reaction - (kill + feed) * bv));
    }
  }

  [a, nextA] = [nextA, a];
  [b, nextB] = [nextB, b];
}

for (let i = 0; i < ITERATIONS; i++) step(i);

const fieldCanvas = createCanvas(SW, SH);
const fctx = fieldCanvas.getContext('2d');
const pixels = new Uint8ClampedArray(SW * SH * 4);

for (let y = 0; y < SH; y++) {
  for (let x = 0; x < SW; x++) {
    const i = y * SW + x;
    const v = b[i];
    const u = a[i];
    const center = Math.exp(-Math.pow((x / SW - 0.5) / 0.31, 2));
    const body = smooth(0.035, 0.36, v);
    const paleRidge = Math.exp(-Math.pow((v - 0.235) / 0.046, 2));
    const copperReaction = Math.exp(-Math.pow((u * v * v - 0.018) / 0.012, 2)) * center;
    const side = smooth(0.22, 0.78, x / SW);

    const base = [7, 10, 20];
    const left = [66, 31, 93];
    const right = [18, 73, 105];
    const field = [mix(left[0], right[0], side), mix(left[1], right[1], side), mix(left[2], right[2], side)];
    const pale = [184, 220, 224];
    const copper = [211, 129, 79];
    let r = mix(base[0], field[0], body * 0.92);
    let g = mix(base[1], field[1], body * 0.92);
    let bl = mix(base[2], field[2], body * 0.92);
    r = mix(r, pale[0], paleRidge * 0.72);
    g = mix(g, pale[1], paleRidge * 0.72);
    bl = mix(bl, pale[2], paleRidge * 0.72);
    r = mix(r, copper[0], copperReaction * 0.58);
    g = mix(g, copper[1], copperReaction * 0.58);
    bl = mix(bl, copper[2], copperReaction * 0.58);

    const p = i * 4;
    pixels[p] = clamp(r, 0, 255);
    pixels[p + 1] = clamp(g, 0, 255);
    pixels[p + 2] = clamp(bl, 0, 255);
    pixels[p + 3] = 255;
  }
}
fctx.putImageData(new ImageData(pixels, SW, SH), 0, 0);

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
const baseGradient = ctx.createLinearGradient(0, 0, W, H);
baseGradient.addColorStop(0, '#090816');
baseGradient.addColorStop(0.48, '#090e18');
baseGradient.addColorStop(1, '#061219');
ctx.fillStyle = baseGradient;
ctx.fillRect(0, 0, W, H);
ctx.save();
ctx.globalAlpha = 0.33;
ctx.filter = 'blur(13px)';
ctx.drawImage(fieldCanvas, -18, -18, W + 36, H + 36);
ctx.restore();

// The chemistry remains underneath as memory; the visible form is traced by
// trajectories moving through the field created by two counter-rotating sources.
ctx.fillStyle = 'rgba(4,7,16,0.18)';
ctx.fillRect(0, 0, W, H);

function fieldVector(x, y) {
  const sources = [
    { x: W * 0.34, y: H * 0.42, spin: 1 },
    { x: W * 0.66, y: H * 0.56, spin: -1 },
  ];
  let vx = 0;
  let vy = 0;
  for (const source of sources) {
    const dx = x - source.x;
    const dy = (y - source.y) * 0.72;
    const r2 = dx * dx + dy * dy + 18000;
    const swirl = 2500 / r2;
    vx += source.spin * -dy * swirl - dx * 0.00072;
    vy += source.spin * dx * swirl - dy * 0.00072;
  }
  vx += Math.sin(y * 0.0068 + Math.cos(x * 0.0041)) * 0.34;
  vy += Math.cos(x * 0.0054 - Math.sin(y * 0.0037)) * 0.25;
  const length = Math.hypot(vx, vy) || 1;
  return [vx / length, vy / length];
}

ctx.save();
ctx.globalCompositeOperation = 'screen';
ctx.lineCap = 'round';
for (let p = 0; p < 1750; p++) {
  const theta = random() * Math.PI * 2;
  const radius = Math.sqrt(random());
  let x = W * 0.5 + Math.cos(theta) * radius * W * (0.16 + random() * 0.29);
  let y = H * 0.49 + Math.sin(theta) * radius * H * (0.15 + random() * 0.25);
  const d1 = Math.hypot((x - W * 0.34) / W, (y - H * 0.42) / H);
  const d2 = Math.hypot((x - W * 0.66) / W, (y - H * 0.56) / H);
  const between = Math.exp(-Math.abs(d1 - d2) * 18);
  const rareLight = random() > 0.965;
  if (rareLight) ctx.strokeStyle = `rgba(198,229,230,${0.12 + random() * 0.12})`;
  else if (between > 0.55) ctx.strokeStyle = `rgba(207,128,79,${0.055 + random() * 0.09})`;
  else if (x < W * 0.5) ctx.strokeStyle = `rgba(112,70,151,${0.045 + random() * 0.07})`;
  else ctx.strokeStyle = `rgba(62,139,169,${0.045 + random() * 0.07})`;
  ctx.lineWidth = 0.45 + random() * 1.05;
  ctx.beginPath();
  ctx.moveTo(x, y);
  const steps = 32 + Math.floor(random() * 66);
  for (let s = 0; s < steps; s++) {
    const [vx, vy] = fieldVector(x, y);
    x += vx * (2.4 + random() * 2.5);
    y += vy * (2.4 + random() * 2.5);
    if (x < 55 || x > W - 55 || y < 190 || y > H - 330) break;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}
ctx.restore();

// Layered glows make the simulation read as a field rather than a flat texture.
ctx.globalCompositeOperation = 'screen';
let glow = ctx.createRadialGradient(W * 0.49, H * 0.49, 0, W * 0.49, H * 0.49, W * 0.62);
glow.addColorStop(0, 'rgba(102,160,184,0.16)');
glow.addColorStop(0.46, 'rgba(84,47,126,0.08)');
glow.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = glow;
ctx.fillRect(0, 0, W, H);

// The equinox appears as a threshold, never as a literal sun or horizon.
const thresholdY = H * 0.505;
const lineGradient = ctx.createLinearGradient(W * 0.08, 0, W * 0.92, 0);
lineGradient.addColorStop(0, 'rgba(198,132,87,0)');
lineGradient.addColorStop(0.28, 'rgba(198,132,87,0.22)');
lineGradient.addColorStop(0.5, 'rgba(217,232,229,0.38)');
lineGradient.addColorStop(0.72, 'rgba(112,160,176,0.20)');
lineGradient.addColorStop(1, 'rgba(112,160,176,0)');
ctx.strokeStyle = lineGradient;
ctx.lineWidth = 1.2;
ctx.beginPath();
ctx.moveTo(W * 0.08, thresholdY);
ctx.lineTo(W * 0.92, thresholdY);
ctx.stroke();
ctx.globalCompositeOperation = 'source-over';

// Fine grain: deterministic and made from the same astronomical seed.
ctx.fillStyle = '#e8ddd0';
for (let i = 0; i < 10500; i++) {
  const x = random() * W;
  const y = random() * H;
  const alpha = 0.012 + random() * 0.045;
  const size = 0.3 + random() * 0.85;
  ctx.globalAlpha = alpha;
  ctx.fillRect(x, y, size, size);
}
ctx.globalAlpha = 1;

const vignette = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.12, W / 2, H * 0.48, H * 0.77);
vignette.addColorStop(0, 'rgba(3,4,9,0)');
vignette.addColorStop(0.72, 'rgba(3,4,9,0.10)');
vignette.addColorStop(1, 'rgba(3,4,9,0.72)');
ctx.fillStyle = vignette;
ctx.fillRect(0, 0, W, H);

// Editorial typography belongs to the study, not to social-media templates.
ctx.textBaseline = 'alphabetic';
ctx.fillStyle = 'rgba(226,227,218,0.78)';
ctx.font = '19px "Nimbus Sans"';
ctx.letterSpacing = '5px';
ctx.fillText('ESTUDOS DO ENTRE  ·  01', 92, 132);

ctx.fillStyle = 'rgba(205,139,94,0.76)';
ctx.fillRect(92, 166, 54, 1.2);

ctx.fillStyle = 'rgba(235,230,217,0.92)';
ctx.font = '72px "C059"';
ctx.fillText('O invisível', 92, H - 292);
ctx.fillStyle = 'rgba(206,151,112,0.96)';
ctx.font = 'italic 82px "C059 Italic"';
ctx.fillText('muda primeiro', 92, H - 205);

ctx.fillStyle = 'rgba(196,205,200,0.56)';
ctx.font = '15px "Nimbus Sans"';
ctx.letterSpacing = '3px';
ctx.fillText('23·09·2026  /  00:05 UTC  /  FIELD 01', 94, H - 126);

const out = path.resolve(__dirname, 'output/estudos-do-entre-01-styleframe.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, canvas.toBuffer('image/png'));
process.stdout.write(`${out}\n`);
