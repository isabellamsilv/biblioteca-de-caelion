const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');

const W = 720;
const H = 1280;
const FPS = 24;
const DURATION = 24;
const FRAMES = FPS * DURATION;
const SEED = 1709251717;
const CX = W / 2;
const PLATE_Y = 824;
const PLATE_RX = 286;
const PLATE_RY = 104;

const fontFiles = [
  ['/usr/share/fonts/opentype/urw-base35/C059-Roman.otf', 'C059'],
  ['/usr/share/fonts/opentype/urw-base35/C059-Italic.otf', 'C059 Italic'],
  ['/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf', 'Nimbus Sans'],
  ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 'DejaVu Mono'],
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

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, value) => {
  const x = clamp((value - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const smoother = (a, b, value) => {
  const x = clamp((value - a) / (b - a));
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const windowAlpha = (t, start, end, fade = 0.45) =>
  smooth(start, start + fade, t) * (1 - smooth(end - fade, end, t));

function diskPoint() {
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(random()) * 0.96;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function chladniPoint() {
  for (let attempt = 0; attempt < 900; attempt++) {
    const [u, v] = diskPoint();
    const x = (u + 1) * 0.5;
    const y = (v + 1) * 0.5;
    const field =
      Math.sin(3 * Math.PI * x) * Math.sin(2 * Math.PI * y) -
      Math.sin(2 * Math.PI * x) * Math.sin(3 * Math.PI * y);
    const threshold = 0.043 + random() * 0.085;
    if (Math.abs(field) < threshold) return [u, v];
  }
  return diskPoint();
}

function finalPoint() {
  const kind = random();
  if (kind < 0.09) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 0.115;
    return {
      u: Math.cos(angle) * radius,
      v: Math.sin(angle) * radius,
      family: 2,
    };
  }
  if (kind < 0.17) {
    const angle = random() * Math.PI * 2;
    const radius = 0.205 + (random() - 0.5) * 0.032;
    return {
      u: Math.cos(angle) * radius,
      v: Math.sin(angle) * radius,
      family: 3,
    };
  }

  const family = random() < 0.5 ? 0 : 1;
  const s = -0.91 + random() * 1.82;
  const envelope = 0.96 - Math.abs(s) * 0.17;
  const wave = Math.sin(s * Math.PI * 1.62);
  const centerPull = Math.sin(s * Math.PI) * 0.035;
  let u = (family === 0 ? 1 : -1) * (0.365 * wave * envelope + centerPull);
  let v = s * 0.82;
  const tangentU = (family === 0 ? 1 : -1) * 0.365 * Math.PI * 1.62 * Math.cos(s * Math.PI * 1.62);
  const tangentV = 0.82;
  const length = Math.hypot(tangentU, tangentV);
  const width = (random() - 0.5) * 0.038;
  u += (-tangentV / length) * width;
  v += (tangentU / length) * width;
  return { u, v, family };
}

const particles = Array.from({ length: 2850 }, (_, index) => {
  const [su, sv] = diskPoint();
  const [au, av] = chladniPoint();
  const destination = finalPoint();
  return {
    su,
    sv,
    au,
    av,
    bu: destination.u,
    bv: destination.v,
    family: destination.family,
    size: 0.45 + random() * 1.18,
    alpha: 0.48 + random() * 0.5,
    copper: random(),
    phase: random() * Math.PI * 2,
    delayA: random() * 0.72,
    delayB: random() * 0.62,
    index,
  };
});

const wallDust = Array.from({ length: 1200 }, () => ({
  x: random() * W,
  y: random() * H,
  size: 0.18 + random() * 0.62,
  alpha: 0.01 + random() * 0.055,
  phase: random() * Math.PI * 2,
}));

const tableFibres = Array.from({ length: 160 }, () => ({
  x: random() * W,
  y: 800 + random() * 480,
  length: 18 + random() * 105,
  alpha: 0.01 + random() * 0.025,
  tilt: (random() - 0.5) * 0.06,
}));

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

function ellipsePath(context, x, y, rx, ry) {
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function roundedRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function mapPlate(u, v) {
  return [CX + u * PLATE_RX, PLATE_Y + v * PLATE_RY];
}

function drawBackground(t) {
  const background = ctx.createLinearGradient(0, 0, W, H);
  background.addColorStop(0, '#080a13');
  background.addColorStop(0.42, '#0b0d17');
  background.addColorStop(0.7, '#0a0b13');
  background.addColorStop(1, '#06070c');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  const leftAtmosphere = ctx.createRadialGradient(72, 270, 0, 72, 270, 520);
  leftAtmosphere.addColorStop(0, 'rgba(87,151,176,0.105)');
  leftAtmosphere.addColorStop(0.48, 'rgba(41,92,116,0.042)');
  leftAtmosphere.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftAtmosphere;
  ctx.fillRect(0, 0, W, 900);

  const rightAtmosphere = ctx.createRadialGradient(655, 300, 0, 655, 300, 510);
  rightAtmosphere.addColorStop(0, 'rgba(104,70,143,0.12)');
  rightAtmosphere.addColorStop(0.52, 'rgba(57,36,84,0.045)');
  rightAtmosphere.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightAtmosphere;
  ctx.fillRect(0, 0, W, 900);

  ctx.strokeStyle = 'rgba(212,221,217,0.018)';
  ctx.lineWidth = 1;
  for (let x = 31; x < W; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 8, 795);
    ctx.stroke();
  }

  ctx.fillStyle = '#090a0e';
  ctx.fillRect(0, 790, W, H - 790);
  const table = ctx.createLinearGradient(0, 790, 0, H);
  table.addColorStop(0, 'rgba(72,63,56,0.28)');
  table.addColorStop(0.19, 'rgba(44,38,35,0.42)');
  table.addColorStop(1, 'rgba(15,15,17,0.96)');
  ctx.fillStyle = table;
  ctx.fillRect(0, 790, W, H - 790);

  ctx.strokeStyle = 'rgba(213,197,175,0.052)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 791.5);
  ctx.lineTo(W, 791.5);
  ctx.stroke();

  for (const fibre of tableFibres) {
    ctx.strokeStyle = `rgba(214,186,155,${fibre.alpha})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(fibre.x, fibre.y);
    ctx.lineTo(fibre.x + fibre.length, fibre.y + fibre.length * fibre.tilt);
    ctx.stroke();
  }

  for (const speck of wallDust) {
    const shimmer = 0.68 + Math.sin(t * 0.24 + speck.phase) * 0.32;
    ctx.fillStyle = `rgba(221,218,204,${speck.alpha * shimmer})`;
    ctx.fillRect(speck.x, speck.y, speck.size, speck.size);
  }
}

function drawLightBeams(t) {
  const reveal = smooth(0.15, 1.8, t);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const left = ctx.createLinearGradient(0, 0, 260, 760);
  left.addColorStop(0, `rgba(170,218,231,${0.09 * reveal})`);
  left.addColorStop(0.5, `rgba(89,157,181,${0.035 * reveal})`);
  left.addColorStop(1, 'rgba(35,83,104,0)');
  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(25, 0);
  ctx.lineTo(165, 0);
  ctx.lineTo(290, 790);
  ctx.lineTo(110, 790);
  ctx.closePath();
  ctx.fill();

  const right = ctx.createLinearGradient(W, 0, 470, 760);
  right.addColorStop(0, `rgba(186,153,220,${0.085 * reveal})`);
  right.addColorStop(0.52, `rgba(119,74,153,${0.033 * reveal})`);
  right.addColorStop(1, 'rgba(58,31,78,0)');
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(566, 0);
  ctx.lineTo(704, 0);
  ctx.lineTo(610, 790);
  ctx.lineTo(430, 790);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGlassField(t) {
  const finalReveal = smooth(20.2, 22.1, t);
  const x = CX - 150;
  const y = 308;
  const width = 300;
  const height = 390;

  ctx.save();
  roundedRectPath(ctx, x, y, width, height, 150);
  ctx.clip();

  const glass = ctx.createLinearGradient(x, y, x + width, y + height);
  glass.addColorStop(0, `rgba(67,126,149,${0.065 + 0.055 * finalReveal})`);
  glass.addColorStop(0.48, `rgba(224,229,215,${0.02 + 0.09 * finalReveal})`);
  glass.addColorStop(1, `rgba(107,67,135,${0.072 + 0.052 * finalReveal})`);
  ctx.fillStyle = glass;
  ctx.fillRect(x, y, width, height);

  const horizonY = 570;
  ctx.fillStyle = `rgba(87,106,91,${0.13 * finalReveal})`;
  ctx.beginPath();
  ctx.moveTo(x, 630);
  ctx.bezierCurveTo(x + 55, 570, x + 96, 586, x + 154, horizonY);
  ctx.bezierCurveTo(x + 220, 548, x + 256, 578, x + width, 550);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(157,104,75,${0.11 * finalReveal})`;
  ctx.beginPath();
  ctx.moveTo(x, 644);
  ctx.bezierCurveTo(x + 70, 611, x + 122, 620, x + 180, 590);
  ctx.bezierCurveTo(x + 238, 558, x + 274, 610, x + width, 588);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  ctx.fill();

  const mist = ctx.createLinearGradient(0, y, 0, y + height);
  mist.addColorStop(0, 'rgba(255,255,255,0)');
  mist.addColorStop(0.62, `rgba(219,223,207,${0.075 * finalReveal})`);
  mist.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mist;
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, x, y, width, height, 150);
  ctx.strokeStyle = `rgba(206,220,218,${0.085 + finalReveal * 0.08})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  if (finalReveal > 0) {
    const beam = ctx.createLinearGradient(CX - 20, 0, CX + 20, 0);
    beam.addColorStop(0, 'rgba(229,234,218,0)');
    beam.addColorStop(0.43, `rgba(229,234,218,${0.08 * finalReveal})`);
    beam.addColorStop(0.5, `rgba(248,241,213,${0.42 * finalReveal})`);
    beam.addColorStop(0.57, `rgba(229,234,218,${0.08 * finalReveal})`);
    beam.addColorStop(1, 'rgba(229,234,218,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(CX - 26, y - 8, 52, 610);
  }
}

function drawPlateBase() {
  ctx.save();
  ctx.filter = 'blur(18px)';
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ellipsePath(ctx, CX, PLATE_Y + 38, PLATE_RX + 18, PLATE_RY + 40);
  ctx.fill();
  ctx.restore();

  const edge = ctx.createLinearGradient(0, PLATE_Y - 20, 0, PLATE_Y + 132);
  edge.addColorStop(0, '#363331');
  edge.addColorStop(0.55, '#1a191a');
  edge.addColorStop(1, '#08090c');
  ctx.fillStyle = edge;
  ellipsePath(ctx, CX, PLATE_Y + 13, PLATE_RX + 8, PLATE_RY + 10);
  ctx.fill();

  const top = ctx.createRadialGradient(CX - 76, PLATE_Y - 40, 10, CX, PLATE_Y, PLATE_RX);
  top.addColorStop(0, '#343b40');
  top.addColorStop(0.42, '#20262b');
  top.addColorStop(0.82, '#12161a');
  top.addColorStop(1, '#080b0f');
  ctx.fillStyle = top;
  ellipsePath(ctx, CX, PLATE_Y, PLATE_RX, PLATE_RY);
  ctx.fill();

  const reflection = ctx.createLinearGradient(CX - PLATE_RX, 0, CX + PLATE_RX, 0);
  reflection.addColorStop(0, 'rgba(87,157,181,0.12)');
  reflection.addColorStop(0.42, 'rgba(187,207,205,0.025)');
  reflection.addColorStop(0.58, 'rgba(187,207,205,0.035)');
  reflection.addColorStop(1, 'rgba(130,80,158,0.12)');
  ctx.fillStyle = reflection;
  ellipsePath(ctx, CX, PLATE_Y, PLATE_RX - 2, PLATE_RY - 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(215,219,207,0.18)';
  ctx.lineWidth = 1.1;
  ellipsePath(ctx, CX, PLATE_Y - 1, PLATE_RX, PLATE_RY);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(196,126,79,0.13)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(CX, PLATE_Y + 4, PLATE_RX + 4, PLATE_RY + 5, 0, 0.03 * Math.PI, 0.97 * Math.PI);
  ctx.stroke();
}

function drawPlateWaves(t) {
  ctx.save();
  ellipsePath(ctx, CX, PLATE_Y, PLATE_RX - 2, PLATE_RY - 2);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';

  const sources = [
    { start: 4.0, x: 190, color: [112, 190, 216] },
    { start: 8.0, x: 530, color: [176, 124, 208] },
  ];

  for (const source of sources) {
    const strength = smooth(source.start, source.start + 1.15, t) * (1 - smooth(20.0, 21.1, t));
    if (strength <= 0) continue;
    for (let ring = 0; ring < 9; ring++) {
      const phase = ((t - source.start) * 0.62 - ring * 0.17) % 1.58;
      if (phase < 0) continue;
      const alpha = strength * (1 - phase / 1.58) * 0.11;
      ctx.strokeStyle = `rgba(${source.color[0]},${source.color[1]},${source.color[2]},${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(source.x, PLATE_Y - 4, phase * 355, phase * 105, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const interference = smooth(8.4, 10.2, t) * (1 - smooth(19.8, 21.0, t));
  if (interference > 0) {
    for (let line = -6; line <= 6; line++) {
      const offset = line * 14;
      ctx.strokeStyle = `rgba(224,211,189,${0.026 * interference * (1 - Math.abs(line) / 9)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let step = 0; step <= 80; step++) {
        const u = -1 + step / 40;
        const x = CX + u * PLATE_RX;
        const y = PLATE_Y + offset + Math.sin(u * Math.PI * 4 + t * 1.8) * 6;
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFinalCurves(t) {
  const alpha = smooth(17.2, 20.0, t) * 0.17;
  if (alpha <= 0) return;
  ctx.save();
  ellipsePath(ctx, CX, PLATE_Y, PLATE_RX - 3, PLATE_RY - 3);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  for (let family = 0; family < 2; family++) {
    const gradient = ctx.createLinearGradient(CX - 120, 0, CX + 120, 0);
    if (family === 0) {
      gradient.addColorStop(0, `rgba(107,189,213,${alpha * 0.55})`);
      gradient.addColorStop(0.5, `rgba(235,218,181,${alpha})`);
      gradient.addColorStop(1, `rgba(192,119,76,${alpha * 0.7})`);
    } else {
      gradient.addColorStop(0, `rgba(192,119,76,${alpha * 0.65})`);
      gradient.addColorStop(0.5, `rgba(235,218,181,${alpha})`);
      gradient.addColorStop(1, `rgba(167,126,207,${alpha * 0.7})`);
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let step = 0; step <= 180; step++) {
      const s = -0.91 + (step / 180) * 1.82;
      const envelope = 0.96 - Math.abs(s) * 0.17;
      const wave = Math.sin(s * Math.PI * 1.62);
      const centerPull = Math.sin(s * Math.PI) * 0.035;
      const u = (family === 0 ? 1 : -1) * (0.365 * wave * envelope + centerPull);
      const v = s * 0.82;
      const [x, y] = mapPlate(u, v);
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(t) {
  ctx.save();
  ellipsePath(ctx, CX, PLATE_Y, PLATE_RX - 5, PLATE_RY - 5);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';

  const microMotion = 1 - smooth(20.0, 21.2, t);
  for (const particle of particles) {
    const aProgress = smoother(11.55 + particle.delayA, 16.35 + particle.delayA * 0.2, t);
    const bProgress = smoother(16.95 + particle.delayB, 20.25 + particle.delayB * 0.25, t);
    let u = mix(particle.su, particle.au, aProgress);
    let v = mix(particle.sv, particle.av, aProgress);
    u = mix(u, particle.bu, bProgress);
    v = mix(v, particle.bv, bProgress);

    const frequency = t < 8 ? 0.55 : 2.0;
    const vibration = Math.sin(t * 12.5 * frequency + particle.phase) * 0.0032 * microMotion;
    const waveBias = Math.sin((u + 1) * 13 + t * 6 + particle.phase) * 0.0016 * smooth(4, 9, t) * microMotion;
    u += vibration + waveBias;
    v += Math.cos(t * 9.2 + particle.phase) * 0.0022 * microMotion;

    const [x, y] = mapPlate(u, v);
    const perspective = 0.72 + (v + 1) * 0.18;
    const radius = particle.size * perspective;
    let red = 187 + particle.copper * 45;
    let green = 103 + particle.copper * 42;
    let blue = 62 + particle.copper * 34;
    let alpha = particle.alpha * (0.68 + smooth(11.5, 16.2, t) * 0.22);

    if (bProgress > 0) {
      if (particle.family === 0) {
        red = mix(red, 155, bProgress * 0.25);
        green = mix(green, 189, bProgress * 0.3);
        blue = mix(blue, 197, bProgress * 0.38);
      } else if (particle.family === 1) {
        red = mix(red, 185, bProgress * 0.18);
        blue = mix(blue, 139, bProgress * 0.28);
      } else if (particle.family === 2) {
        red = mix(red, 244, bProgress * 0.75);
        green = mix(green, 229, bProgress * 0.8);
        blue = mix(blue, 191, bProgress * 0.82);
        alpha = Math.min(1, alpha + 0.25 * bProgress);
      }
    }

    ctx.fillStyle = `rgba(${Math.round(red)},${Math.round(green)},${Math.round(blue)},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const core = smooth(18.5, 21.4, t);
  if (core > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(CX, PLATE_Y, 0, CX, PLATE_Y, 64);
    glow.addColorStop(0, `rgba(255,240,195,${0.55 * core})`);
    glow.addColorStop(0.1, `rgba(235,214,177,${0.34 * core})`);
    glow.addColorStop(0.4, `rgba(185,142,113,${0.1 * core})`);
    glow.addColorStop(1, 'rgba(120,90,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(CX - 70, PLATE_Y - 70, 140, 140);
    ctx.restore();
  }
}

function metalGradient(x, color) {
  const gradient = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
  if (color === 'blue') {
    gradient.addColorStop(0, '#304b59');
    gradient.addColorStop(0.2, '#8fb4c0');
    gradient.addColorStop(0.44, '#e0e8e5');
    gradient.addColorStop(0.58, '#7297a4');
    gradient.addColorStop(0.84, '#d5dfdd');
    gradient.addColorStop(1, '#263a45');
  } else {
    gradient.addColorStop(0, '#413549');
    gradient.addColorStop(0.18, '#9c89ad');
    gradient.addColorStop(0.4, '#e2dcdf');
    gradient.addColorStop(0.58, '#8c789c');
    gradient.addColorStop(0.83, '#cfbecf');
    gradient.addColorStop(1, '#342b3d');
  }
  return gradient;
}

function forkPath(x, side, vibration = 0) {
  const leftTop = x - 31 - vibration;
  const rightTop = x + 31 + vibration;
  const neckY = side === 'left' ? 688 : 696;
  const topY = side === 'left' ? 443 : 461;
  const baseY = 846;

  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, neckY + 34);
  ctx.bezierCurveTo(x, neckY + 13, x - 8, neckY + 5, x - 21, neckY - 3);
  ctx.bezierCurveTo(x - 29, neckY - 8, leftTop, neckY - 19, leftTop, neckY - 41);
  ctx.lineTo(leftTop, topY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, neckY + 34);
  ctx.bezierCurveTo(x, neckY + 13, x + 8, neckY + 5, x + 21, neckY - 3);
  ctx.bezierCurveTo(x + 29, neckY - 8, rightTop, neckY - 19, rightTop, neckY - 41);
  ctx.lineTo(rightTop, topY);
  ctx.stroke();
}

function drawFork(x, side, t) {
  const start = side === 'left' ? 4.0 : 8.0;
  const active = smooth(start, start + 0.55, t) * (1 - smooth(20.25, 21.15, t));
  const amplitude = (side === 'left' ? 2.8 : 2.25) * active;
  const vibration = Math.sin(t * (side === 'left' ? 43.0 : 42.2) + (side === 'left' ? 0 : 0.7)) * amplitude;
  const color = side === 'left' ? 'blue' : 'violet';

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = 'rgba(0,0,0,0.64)';
  ctx.lineWidth = side === 'left' ? 20 : 22;
  ctx.save();
  ctx.translate(5, 8);
  forkPath(x, side, vibration);
  ctx.restore();

  if (active > 0.05) {
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = side === 'left'
      ? `rgba(119,200,226,${0.075 * active})`
      : `rgba(190,132,220,${0.075 * active})`;
    ctx.lineWidth = side === 'left' ? 18 : 20;
    ctx.save();
    ctx.translate(-vibration * 1.5, 0);
    forkPath(x, side, vibration * 0.6);
    ctx.restore();
    ctx.save();
    ctx.translate(vibration * 1.5, 0);
    forkPath(x, side, -vibration * 0.6);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.shadowColor = side === 'left' ? 'rgba(102,183,208,0.35)' : 'rgba(170,112,201,0.33)';
  ctx.shadowBlur = 13 + active * 10;
  ctx.strokeStyle = metalGradient(x, color);
  ctx.lineWidth = side === 'left' ? 14 : 16;
  forkPath(x, side, vibration);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = side === 'left' ? 'rgba(235,247,244,0.34)' : 'rgba(242,232,240,0.32)';
  ctx.lineWidth = 1.4;
  ctx.save();
  ctx.translate(-3, -1);
  forkPath(x, side, vibration);
  ctx.restore();

  const topY = side === 'left' ? 443 : 461;
  const capGradient = ctx.createRadialGradient(x - 4, topY - 4, 0, x, topY, 21);
  capGradient.addColorStop(0, side === 'left' ? '#edf6f3' : '#efe6ef');
  capGradient.addColorStop(0.4, side === 'left' ? '#91b6c1' : '#a690ad');
  capGradient.addColorStop(1, side === 'left' ? '#2d4652' : '#44374c');
  ctx.fillStyle = capGradient;
  for (const sign of [-1, 1]) {
    const capX = x + sign * (31 + vibration);
    roundedRectPath(ctx, capX - 8, topY - 11, 16, 22, 7);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(10,11,15,0.9)';
  ellipsePath(ctx, x, 858, 25, 9);
  ctx.fill();
  ctx.fillStyle = metalGradient(x, color);
  roundedRectPath(ctx, x - 17, 826, 34, 43, 12);
  ctx.fill();
  ctx.strokeStyle = side === 'left' ? 'rgba(184,224,231,0.22)' : 'rgba(217,183,226,0.2)';
  ctx.lineWidth = 1;
  roundedRectPath(ctx, x - 17, 826, 34, 43, 12);
  ctx.stroke();
  ctx.restore();
}

function drawAirFilaments(t) {
  const left = smooth(4.15, 5.2, t) * (1 - smooth(12.5, 14.0, t));
  const right = smooth(8.1, 9.1, t) * (1 - smooth(13.0, 14.2, t));
  if (left + right <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineWidth = 0.8;
  for (let index = 0; index < 15; index++) {
    const y = 485 + index * 17;
    const wobble = Math.sin(t * 3.2 + index * 0.8) * 7;
    ctx.strokeStyle = `rgba(137,205,222,${left * (0.018 + (index % 4) * 0.006)})`;
    ctx.beginPath();
    ctx.moveTo(216, y);
    ctx.bezierCurveTo(270, y - 18 + wobble, 344, y + 15 - wobble, 505, y + 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(194,151,216,${right * (0.017 + ((index + 2) % 4) * 0.006)})`;
    ctx.beginPath();
    ctx.moveTo(504, y + 5);
    ctx.bezierCurveTo(448, y + 22 - wobble, 375, y - 14 + wobble, 216, y + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParameters(t) {
  const alpha = windowAlpha(t, 8.1, 12.25, 0.55);
  if (alpha <= 0) return;
  const converge = smooth(8.3, 11.3, t);
  const f2 = mix(219.37, 220.0, converge).toFixed(2);

  ctx.save();
  ctx.font = '10px "DejaVu Mono"';
  ctx.letterSpacing = '1.2px';
  ctx.fillStyle = `rgba(155,203,215,${0.55 * alpha})`;
  ctx.fillText('f₁  220.00 Hz', 49, 342);
  ctx.fillText('A₁  +0.34', 49, 360);
  ctx.fillStyle = `rgba(195,163,211,${0.55 * alpha})`;
  ctx.fillText(`f₂  ${f2} Hz`, 548, 342);
  ctx.fillText(`Δφ  ${(0.41 * (1 - converge)).toFixed(2)}π`, 548, 360);

  ctx.strokeStyle = `rgba(208,215,209,${0.18 * alpha})`;
  ctx.lineWidth = 0.7;
  for (const x of [49, 671]) {
    ctx.beginPath();
    ctx.moveTo(x, 380);
    ctx.lineTo(x, 702);
    for (let y = 397; y <= 692; y += 23) {
      ctx.moveTo(x + (x < CX ? 0 : -5), y);
      ctx.lineTo(x + (x < CX ? 5 : 0), y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrackedText(text, x, y, tracking, align = 'left') {
  const characters = [...text];
  const widths = characters.map((character) => ctx.measureText(character).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * (characters.length - 1);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (let index = 0; index < characters.length; index++) {
    ctx.fillText(characters[index], cursor, y);
    cursor += widths[index] + tracking;
  }
}

function drawPhrase(lines, t, start, end, y, options = {}) {
  const alpha = windowAlpha(t, start, end, options.fade || 0.52);
  if (alpha <= 0) return;
  const rise = (1 - smooth(start, start + 0.85, t)) * 10;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(235,231,218,${alpha * (options.alpha || 0.92)})`;
  ctx.font = `${options.italic ? 'italic ' : ''}${options.size || 28}px "${options.italic ? 'C059 Italic' : 'C059'}"`;
  const gap = options.gap || 34;
  lines.forEach((line, index) => ctx.fillText(line, CX, y + rise + index * gap));
  ctx.restore();
}

function drawTypography(t) {
  const headerAlpha = smooth(0.25, 1.1, t) * (1 - smooth(21.1, 22.0, t));
  ctx.save();
  ctx.font = '9px "Nimbus Sans"';
  ctx.fillStyle = `rgba(213,216,207,${0.48 * headerAlpha})`;
  drawTrackedText('ESTUDOS DO ENTRE  ·  01', CX, 70, 3.2, 'center');
  ctx.restore();

  drawPhrase(['Uma estação começa', 'antes de tocar a paisagem.'], t, 0.65, 4.05, 155, { size: 29, gap: 36 });
  drawPhrase(['Primeiro, muda o campo.'], t, 4.15, 8.05, 175, { size: 31, italic: true });
  drawPhrase(['Os parâmetros se deslocam', 'quase sem ruído.'], t, 8.15, 12.05, 151, { size: 27, gap: 34 });
  drawPhrase(['A matéria responde.'], t, 12.05, 16.85, 175, { size: 32, italic: true });
  drawPhrase(['E aquilo que parecia estável', 'aprende uma nova forma.'], t, 16.85, 20.9, 151, { size: 27, gap: 35 });
  drawPhrase(['O invisível', 'muda primeiro.'], t, 20.7, 24.0, 137, { size: 37, gap: 43, italic: true, fade: 0.65 });

  const finalAlpha = smooth(21.55, 22.4, t) * (1 - smooth(23.75, 24, t));
  if (finalAlpha > 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '9px "Nimbus Sans"';
    ctx.fillStyle = `rgba(222,218,203,${0.61 * finalAlpha})`;
    drawTrackedText('ESTUDOS DO ENTRE  ·  01', CX, 1088, 3.2, 'center');
    ctx.fillStyle = `rgba(191,132,93,${0.73 * finalAlpha})`;
    ctx.fillRect(CX - 18, 1111, 36, 0.8);
    ctx.fillStyle = `rgba(203,208,200,${0.47 * finalAlpha})`;
    ctx.font = '8px "DejaVu Mono"';
    drawTrackedText('23·09·2026  ·  EQUINÓCIO', CX, 1141, 2.1, 'center');
    ctx.restore();
  }
}

function drawVignette() {
  const vignette = ctx.createRadialGradient(CX, H * 0.48, H * 0.12, CX, H * 0.48, H * 0.74);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.65, 'rgba(0,0,0,0.08)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.74)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  const topShade = ctx.createLinearGradient(0, 0, 0, 250);
  topShade.addColorStop(0, 'rgba(3,4,8,0.48)');
  topShade.addColorStop(1, 'rgba(3,4,8,0)');
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, W, 260);
}

function drawFrame(t) {
  ctx.clearRect(0, 0, W, H);
  drawBackground(t);
  drawLightBeams(t);
  drawGlassField(t);
  drawAirFilaments(t);
  drawFork(190, 'left', t);
  drawFork(530, 'right', t);
  drawPlateBase();
  drawPlateWaves(t);
  drawFinalCurves(t);
  drawParticles(t);
  drawParameters(t);
  drawVignette();
  drawTypography(t);

  const fadeIn = smooth(0, 0.72, t);
  const fadeOut = 1 - smooth(DURATION - 0.32, DURATION, t);
  const veil = 1 - fadeIn * fadeOut;
  if (veil > 0) {
    ctx.fillStyle = `rgba(4,5,10,${veil})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function savePng(outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
}

function renderPreview() {
  const reviewDir = path.resolve(__dirname, 'review/resonance');
  fs.mkdirSync(reviewDir, { recursive: true });
  const times = [2.4, 6.1, 10.2, 16.25, 20.35, 22.45];
  const labels = ['01 · LIMIAR', '02 · CAMPO', '03 · RESSONÂNCIA', '04 · MATÉRIA', '05 · NOVA FORMA', '06 · EQUINÓCIO'];
  const frameBuffers = [];

  times.forEach((time, index) => {
    drawFrame(time);
    const file = path.join(reviewDir, `frame-${String(index + 1).padStart(2, '0')}.png`);
    savePng(file);
    frameBuffers.push(canvas.toBuffer('image/png'));
  });

  const sheetW = 1120;
  const thumbW = 500;
  const thumbH = Math.round((thumbW / W) * H);
  const margin = 40;
  const labelH = 46;
  const gap = 28;
  const sheetH = margin * 2 + (thumbH + labelH) * 3 + gap * 2;
  const sheet = createCanvas(sheetW, sheetH);
  const sheetCtx = sheet.getContext('2d');
  sheetCtx.fillStyle = '#080911';
  sheetCtx.fillRect(0, 0, sheetW, sheetH);

  frameBuffers.forEach((buffer, index) => {
    const { loadImage } = require('@napi-rs/canvas');
    frameBuffers[index] = loadImage(buffer);
  });

  return Promise.all(frameBuffers).then((images) => {
    images.forEach((image, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + column * (thumbW + gap);
      const y = margin + row * (thumbH + labelH + gap);
      sheetCtx.drawImage(image, x, y, thumbW, thumbH);
      sheetCtx.fillStyle = 'rgba(225,222,211,0.72)';
      sheetCtx.font = '12px "DejaVu Mono"';
      sheetCtx.fillText(labels[index], x, y + thumbH + 27);
      sheetCtx.fillStyle = 'rgba(191,132,93,0.72)';
      sheetCtx.fillText(`${times[index].toFixed(2)} s`, x + thumbW - 58, y + thumbH + 27);
    });
    const contactPath = path.resolve(__dirname, 'review/resonance-contact-sheet.png');
    fs.writeFileSync(contactPath, sheet.toBuffer('image/png'));
    drawFrame(20.35);
    savePng(path.resolve(__dirname, 'output/estudos-do-entre-01-ressonancia-styleframe.png'));
    process.stdout.write(`${contactPath}\n`);
  });
}

async function renderVideo() {
  const outputPath = path.resolve(__dirname, 'output/estudos-do-entre-01-ressonancia-silent.mp4');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(FPS), '-i', '-',
    '-an', '-vf', 'scale=1080:1920:flags=lanczos',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outputPath,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let frame = 0; frame < FRAMES; frame++) {
    drawFrame(frame / FPS);
    const png = canvas.toBuffer('image/png');
    if (!ffmpeg.stdin.write(png)) await once(ffmpeg.stdin, 'drain');
    if (frame % 48 === 0) process.stderr.write(`ressonância ${frame}/${FRAMES}\n`);
  }

  ffmpeg.stdin.end();
  const [code] = await once(ffmpeg, 'close');
  if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
  process.stdout.write(`${outputPath}\n`);
}

async function main() {
  if (process.argv.includes('--render')) await renderVideo();
  else await renderPreview();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
