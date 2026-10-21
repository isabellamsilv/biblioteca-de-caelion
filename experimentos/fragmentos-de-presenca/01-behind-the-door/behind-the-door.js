const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');

const W = 720;
const H = 1280;
const FPS = 24;
const DURATION = 17;
const FRAMES = FPS * DURATION;
const SEED = 2409261206;

const DOOR = {
  left: 166,
  right: 554,
  top: 170,
  bottom: 1038,
};

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
const windowAlpha = (t, start, end, fade = 0.48) =>
  smooth(start, start + fade, t) * (1 - smooth(end - fade, end, t));

const grain = Array.from({ length: 2600 }, () => ({
  x: random() * W,
  y: random() * H,
  size: 0.2 + random() * 0.9,
  alpha: 0.008 + random() * 0.045,
  phase: random() * Math.PI * 2,
}));

const dust = Array.from({ length: 220 }, () => ({
  x: DOOR.left + 28 + random() * (DOOR.right - DOOR.left - 56),
  y: DOOR.top + 70 + random() * (DOOR.bottom - DOOR.top - 160),
  radius: 0.35 + random() * 1.25,
  alpha: 0.04 + random() * 0.14,
  speed: 0.5 + random() * 1.6,
  phase: random() * Math.PI * 2,
}));

const cityLights = Array.from({ length: 46 }, () => ({
  x: random(),
  y: random(),
  radius: 1.5 + random() * 6,
  hue: random() < 0.68 ? 'warm' : 'cool',
  phase: random() * Math.PI * 2,
  speed: 0.1 + random() * 0.55,
}));

const woodLines = Array.from({ length: 64 }, (_, index) => ({
  u: (index + random() * 0.7) / 64,
  bend: (random() - 0.5) * 9,
  alpha: 0.012 + random() * 0.038,
  phase: random() * Math.PI * 2,
}));

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

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

function drawTrackedText(text, x, y, tracking, align = 'left') {
  const characters = [...text];
  const widths = characters.map((character) => ctx.measureText(character).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * Math.max(0, characters.length - 1);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  for (let index = 0; index < characters.length; index++) {
    ctx.fillText(characters[index], cursor, y);
    cursor += widths[index] + tracking;
  }
}

function drawCorridor(t) {
  const wall = ctx.createLinearGradient(0, 0, W, H);
  wall.addColorStop(0, '#080b10');
  wall.addColorStop(0.42, '#0d1118');
  wall.addColorStop(0.72, '#0a0c12');
  wall.addColorStop(1, '#05070a');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);

  const sideLight = ctx.createRadialGradient(48, 480, 0, 48, 480, 470);
  sideLight.addColorStop(0, 'rgba(48,77,91,0.075)');
  sideLight.addColorStop(0.62, 'rgba(28,44,53,0.025)');
  sideLight.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sideLight;
  ctx.fillRect(0, 0, 420, H);

  const floorY = DOOR.bottom;
  const floor = ctx.createLinearGradient(0, floorY, 0, H);
  floor.addColorStop(0, '#101116');
  floor.addColorStop(0.42, '#090a0e');
  floor.addColorStop(1, '#040508');
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, W, H - floorY);

  ctx.strokeStyle = 'rgba(157,171,176,0.022)';
  ctx.lineWidth = 1;
  for (let index = -5; index <= 5; index++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + index * 45, floorY);
    ctx.lineTo(W / 2 + index * 132, H);
    ctx.stroke();
  }
  for (let y = floorY + 25; y < H; y += 46) {
    const perspective = (y - floorY) / (H - floorY);
    ctx.strokeStyle = `rgba(157,171,176,${0.012 + perspective * 0.018})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  const frameShadow = ctx.createRadialGradient(W / 2, 650, 20, W / 2, 650, 520);
  frameShadow.addColorStop(0, 'rgba(0,0,0,0)');
  frameShadow.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = frameShadow;
  ctx.fillRect(0, 0, W, H);

  for (const speck of grain) {
    const shimmer = 0.73 + Math.sin(t * 0.31 + speck.phase) * 0.27;
    ctx.fillStyle = `rgba(224,218,202,${speck.alpha * shimmer})`;
    ctx.fillRect(speck.x, speck.y, speck.size, speck.size);
  }
}

function drawDoorFrame() {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.76)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#16171a';
  ctx.fillRect(DOOR.left - 22, DOOR.top - 25, DOOR.right - DOOR.left + 44, 26);
  ctx.fillRect(DOOR.left - 22, DOOR.top - 25, 22, DOOR.bottom - DOOR.top + 50);
  ctx.fillRect(DOOR.right, DOOR.top - 25, 22, DOOR.bottom - DOOR.top + 50);
  ctx.restore();

  const top = ctx.createLinearGradient(DOOR.left, 0, DOOR.right, 0);
  top.addColorStop(0, '#24252a');
  top.addColorStop(0.45, '#36343a');
  top.addColorStop(1, '#17181c');
  ctx.fillStyle = top;
  ctx.fillRect(DOOR.left - 17, DOOR.top - 19, DOOR.right - DOOR.left + 34, 18);

  const left = ctx.createLinearGradient(DOOR.left - 16, 0, DOOR.left + 2, 0);
  left.addColorStop(0, '#15171b');
  left.addColorStop(0.66, '#34343a');
  left.addColorStop(1, '#191a1f');
  ctx.fillStyle = left;
  ctx.fillRect(DOOR.left - 17, DOOR.top - 1, 18, DOOR.bottom - DOOR.top + 22);

  const right = ctx.createLinearGradient(DOOR.right - 2, 0, DOOR.right + 18, 0);
  right.addColorStop(0, '#3a373e');
  right.addColorStop(0.35, '#222329');
  right.addColorStop(1, '#101216');
  ctx.fillStyle = right;
  ctx.fillRect(DOOR.right - 1, DOOR.top - 1, 18, DOOR.bottom - DOOR.top + 22);
}

function drawCityWindow(t, reveal) {
  const x = 208;
  const y = 250;
  const width = 250;
  const height = 305;

  ctx.save();
  roundedRectPath(ctx, x, y, width, height, 8);
  ctx.clip();
  const night = ctx.createLinearGradient(0, y, 0, y + height);
  night.addColorStop(0, '#101725');
  night.addColorStop(0.5, '#18202b');
  night.addColorStop(1, '#252128');
  ctx.fillStyle = night;
  ctx.fillRect(x, y, width, height);

  for (const light of cityLights) {
    const drift = ((light.x + t * light.speed * 0.012) % 1) * width;
    const px = x + drift;
    const py = y + 70 + light.y * (height - 90);
    const pulse = 0.68 + Math.sin(t * 0.7 + light.phase) * 0.32;
    ctx.save();
    ctx.filter = `blur(${Math.max(1, light.radius * 0.55)}px)`;
    ctx.fillStyle = light.hue === 'warm'
      ? `rgba(232,154,86,${0.25 * pulse * reveal})`
      : `rgba(104,161,193,${0.22 * pulse * reveal})`;
    ctx.beginPath();
    ctx.arc(px, py, light.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = `rgba(183,203,208,${0.1 * reveal})`;
  ctx.lineWidth = 0.7;
  for (let index = 0; index < 19; index++) {
    const rx = x + 8 + ((index * 37 + t * 3.2) % (width - 16));
    const ry = y + ((index * 83) % height);
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 4, Math.min(y + height, ry + 26 + (index % 5) * 7));
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = `rgba(195,188,179,${0.13 * reveal})`;
  ctx.lineWidth = 5;
  roundedRectPath(ctx, x, y, width, height, 8);
  ctx.stroke();
  ctx.strokeStyle = `rgba(27,24,27,${0.68 * reveal})`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.54, y);
  ctx.lineTo(x + width * 0.54, y + height);
  ctx.stroke();
}

function drawLamp(t, reveal) {
  const glowStrength = reveal * (0.91 + Math.sin(t * 0.38) * 0.03);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = 'blur(20px)';
  const glow = ctx.createRadialGradient(466, 666, 0, 466, 666, 190);
  glow.addColorStop(0, `rgba(255,196,116,${0.27 * glowStrength})`);
  glow.addColorStop(0.45, `rgba(229,142,73,${0.105 * glowStrength})`);
  glow.addColorStop(1, 'rgba(120,62,31,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(270, 470, 390, 390);
  ctx.restore();

  ctx.strokeStyle = `rgba(120,87,61,${0.86 * reveal})`;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(482, 792);
  ctx.lineTo(475, 671);
  ctx.lineTo(433, 622);
  ctx.stroke();

  ctx.fillStyle = `rgba(154,105,67,${0.92 * reveal})`;
  ctx.beginPath();
  ctx.moveTo(402, 606);
  ctx.lineTo(468, 604);
  ctx.lineTo(493, 655);
  ctx.lineTo(425, 655);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(255,219,157,${0.66 * glowStrength})`;
  ctx.beginPath();
  ctx.moveTo(420, 650);
  ctx.lineTo(486, 650);
  ctx.lineTo(473, 662);
  ctx.lineTo(430, 662);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(66,48,40,${0.9 * reveal})`;
  ctx.beginPath();
  ctx.ellipse(482, 797, 29, 9, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDesk(reveal) {
  const shadow = ctx.createLinearGradient(0, 773, 0, 915);
  shadow.addColorStop(0, `rgba(76,49,37,${0.98 * reveal})`);
  shadow.addColorStop(0.18, `rgba(48,31,27,${0.98 * reveal})`);
  shadow.addColorStop(1, `rgba(23,19,20,${0.98 * reveal})`);
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.moveTo(178, 772);
  ctx.lineTo(548, 772);
  ctx.lineTo(554, 913);
  ctx.lineTo(167, 913);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgba(223,168,111,${0.13 * reveal})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(179, 774);
  ctx.lineTo(548, 774);
  ctx.stroke();

  ctx.fillStyle = `rgba(18,16,18,${0.96 * reveal})`;
  ctx.fillRect(194, 908, 28, 130);
  ctx.fillRect(503, 908, 28, 130);
}

function drawNotebook(t, reveal) {
  const x = 261;
  const y = 790;
  const width = 174;
  const height = 92;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 13;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = `rgba(203,190,164,${0.94 * reveal})`;
  ctx.beginPath();
  ctx.moveTo(x, y + 13);
  ctx.lineTo(x + width * 0.48, y);
  ctx.lineTo(x + width, y + 15);
  ctx.lineTo(x + width - 4, y + height);
  ctx.lineTo(x + width * 0.5, y + height - 10);
  ctx.lineTo(x + 3, y + height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = `rgba(73,59,53,${0.28 * reveal})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.5, y + 2);
  ctx.lineTo(x + width * 0.5, y + height - 10);
  ctx.stroke();

  for (let line = 0; line < 5; line++) {
    const lineY = y + 28 + line * 11;
    ctx.strokeStyle = `rgba(94,82,73,${0.09 * reveal})`;
    ctx.beginPath();
    ctx.moveTo(x + 14, lineY);
    ctx.lineTo(x + width * 0.43, lineY - 5);
    ctx.moveTo(x + width * 0.57, lineY - 5);
    ctx.lineTo(x + width - 15, lineY);
    ctx.stroke();
  }

  const writing = smooth(8.45, 11.15, t);
  if (writing > 0) {
    const points = [];
    for (let index = 0; index <= 110; index++) {
      const progress = index / 110;
      const px = x + 15 + progress * 62;
      const py = y + 33 + Math.sin(progress * Math.PI * 5.4) * (2.3 + progress * 1.4) + progress * 26;
      points.push([px, py]);
    }
    const visible = Math.max(2, Math.floor(points.length * writing));
    ctx.strokeStyle = `rgba(82,78,75,${0.58 * reveal})`;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let index = 1; index < visible; index++) ctx.lineTo(points[index][0], points[index][1]);
    ctx.stroke();
  }
}

function drawMug(reveal) {
  ctx.fillStyle = `rgba(53,50,49,${0.95 * reveal})`;
  roundedRectPath(ctx, 214, 810, 39, 48, 8);
  ctx.fill();
  ctx.strokeStyle = `rgba(185,150,116,${0.19 * reveal})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(252, 832, 14, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(233,181,125,${0.15 * reveal})`;
  ctx.beginPath();
  ctx.ellipse(233.5, 814, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawLivingThought(t, reveal) {
  const approach = smooth(9.45, 11.2, t);
  const emergence = smooth(10.95, 13.25, t);
  if (approach <= 0) return;
  const cx = 350;
  const cy = 742;

  function bezierPoint(p0, p1, p2, p3, amount) {
    const inverse = 1 - amount;
    return [
      inverse ** 3 * p0[0] + 3 * inverse ** 2 * amount * p1[0] + 3 * inverse * amount ** 2 * p2[0] + amount ** 3 * p3[0],
      inverse ** 3 * p0[1] + 3 * inverse ** 2 * amount * p1[1] + 3 * inverse * amount ** 2 * p2[1] + amount ** 3 * p3[1],
    ];
  }

  function strokeGrowingCurve(points, progress, color, width, blur = 0) {
    const steps = 64;
    const visible = Math.max(1, Math.floor(steps * progress));
    ctx.save();
    if (blur > 0) ctx.filter = `blur(${blur}px)`;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let index = 0; index <= visible; index++) {
      const point = bezierPoint(points[0], points[1], points[2], points[3], index / steps);
      if (index === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  const breathe = Math.sin(t * 1.25) * 2.2;
  const leftCurve = [[286, 777], [298, 745 + breathe], [329, 756], [cx, cy]];
  const rightCurve = [[414, 777], [405, 739 - breathe], [372, 758], [cx, cy]];
  const risingCurveA = [[cx, cy], [329, 713], [303, 715], [321, 686]];
  const risingCurveB = [[321, 686], [340, 657], [393, 687], [404, 651 + breathe * 0.35]];

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  strokeGrowingCurve(leftCurve, approach, `rgba(112,185,207,${0.72 * reveal})`, 6, 9);
  strokeGrowingCurve(rightCurve, approach, `rgba(227,148,87,${0.72 * reveal})`, 6, 9);
  strokeGrowingCurve(leftCurve, approach, `rgba(131,198,216,${0.82 * reveal})`, 1.45);
  strokeGrowingCurve(rightCurve, approach, `rgba(232,159,98,${0.84 * reveal})`, 1.45);

  if (emergence > 0) {
    const firstPart = clamp(emergence * 1.7);
    const secondPart = clamp((emergence - 0.38) / 0.62);
    strokeGrowingCurve(risingCurveA, firstPart, `rgba(245,222,177,${0.24 * reveal})`, 6, 8);
    strokeGrowingCurve(risingCurveB, secondPart, `rgba(245,222,177,${0.22 * reveal})`, 6, 8);
    strokeGrowingCurve(risingCurveA, firstPart, `rgba(239,226,197,${0.92 * reveal})`, 1.35);
    strokeGrowingCurve(risingCurveB, secondPart, `rgba(239,226,197,${0.88 * reveal})`, 1.35);
  }

  const point = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25);
  point.addColorStop(0, `rgba(255,239,196,${0.86 * approach * reveal})`);
  point.addColorStop(0.17, `rgba(241,184,111,${0.4 * approach * reveal})`);
  point.addColorStop(1, 'rgba(200,125,74,0)');
  ctx.fillStyle = point;
  ctx.fillRect(cx - 28, cy - 28, 56, 56);
  ctx.restore();
}

function drawInterior(t, openness) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(DOOR.left, DOOR.top, DOOR.right - DOOR.left, DOOR.bottom - DOOR.top);
  ctx.clip();

  const reveal = smooth(0.02, 0.58, openness);
  const wall = ctx.createLinearGradient(DOOR.left, DOOR.top, DOOR.right, DOOR.bottom);
  wall.addColorStop(0, '#342728');
  wall.addColorStop(0.48, '#45302c');
  wall.addColorStop(1, '#1f1b20');
  ctx.fillStyle = wall;
  ctx.fillRect(DOOR.left, DOOR.top, DOOR.right - DOOR.left, DOOR.bottom - DOOR.top);

  const lampWash = ctx.createRadialGradient(470, 620, 0, 470, 620, 390);
  lampWash.addColorStop(0, `rgba(239,167,96,${0.22 * reveal})`);
  lampWash.addColorStop(0.5, `rgba(175,97,59,${0.07 * reveal})`);
  lampWash.addColorStop(1, 'rgba(80,40,30,0)');
  ctx.fillStyle = lampWash;
  ctx.fillRect(DOOR.left, DOOR.top, DOOR.right - DOOR.left, DOOR.bottom - DOOR.top);

  drawCityWindow(t, reveal);
  drawDesk(reveal);
  drawLamp(t, reveal);
  drawMug(reveal);
  drawNotebook(t, reveal);
  drawLivingThought(t, reveal);

  for (const mote of dust) {
    const y = mote.y - ((t * mote.speed * 2.2 + mote.phase * 6) % 80);
    const x = mote.x + Math.sin(t * 0.35 + mote.phase) * 8;
    ctx.fillStyle = `rgba(246,209,160,${mote.alpha * reveal})`;
    ctx.beginPath();
    ctx.arc(x, y, mote.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawClosedLight(t, openness) {
  const strength = (1 - openness * 0.72) * smooth(0.25, 1.3, t);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = 'blur(13px)';
  const floorGlow = ctx.createRadialGradient(W / 2, DOOR.bottom + 4, 0, W / 2, DOOR.bottom + 4, 205);
  floorGlow.addColorStop(0, `rgba(249,185,108,${0.33 * strength})`);
  floorGlow.addColorStop(0.42, `rgba(218,126,69,${0.115 * strength})`);
  floorGlow.addColorStop(1, 'rgba(150,70,40,0)');
  ctx.fillStyle = floorGlow;
  ctx.fillRect(DOOR.left - 65, DOOR.bottom - 25, DOOR.right - DOOR.left + 130, 180);
  ctx.restore();

  const line = ctx.createLinearGradient(DOOR.left, 0, DOOR.right, 0);
  line.addColorStop(0, 'rgba(244,175,98,0)');
  line.addColorStop(0.17, `rgba(251,199,127,${0.34 * strength})`);
  line.addColorStop(0.5, `rgba(255,216,155,${0.7 * strength})`);
  line.addColorStop(0.83, `rgba(251,199,127,${0.34 * strength})`);
  line.addColorStop(1, 'rgba(244,175,98,0)');
  ctx.fillStyle = line;
  ctx.fillRect(DOOR.left + 3, DOOR.bottom - 2, DOOR.right - DOOR.left - 6, 3);
}

function doorGeometry(openness) {
  const fullWidth = DOOR.right - DOOR.left;
  const projectedWidth = fullWidth * mix(1, 0.18, smoother(0, 1, openness));
  const freeX = DOOR.right - projectedWidth;
  const lift = openness * 8;
  return { projectedWidth, freeX, lift };
}

function panelPoint(geometry, u, v) {
  const topLeft = [geometry.freeX, DOOR.top + geometry.lift];
  const topRight = [DOOR.right, DOOR.top];
  const bottomLeft = [geometry.freeX, DOOR.bottom - geometry.lift];
  const bottomRight = [DOOR.right, DOOR.bottom];
  const topX = mix(topLeft[0], topRight[0], u);
  const topY = mix(topLeft[1], topRight[1], u);
  const bottomX = mix(bottomLeft[0], bottomRight[0], u);
  const bottomY = mix(bottomLeft[1], bottomRight[1], u);
  return [mix(topX, bottomX, v), mix(topY, bottomY, v)];
}

function doorPolygon(geometry) {
  ctx.beginPath();
  ctx.moveTo(geometry.freeX, DOOR.top + geometry.lift);
  ctx.lineTo(DOOR.right, DOOR.top);
  ctx.lineTo(DOOR.right, DOOR.bottom);
  ctx.lineTo(geometry.freeX, DOOR.bottom - geometry.lift);
  ctx.closePath();
}

function drawDoor(t, openness) {
  const geometry = doorGeometry(openness);
  ctx.save();

  ctx.save();
  ctx.filter = 'blur(22px)';
  ctx.fillStyle = `rgba(0,0,0,${0.62 - openness * 0.18})`;
  ctx.beginPath();
  ctx.moveTo(geometry.freeX - 16, DOOR.top + 18);
  ctx.lineTo(DOOR.right + 30, DOOR.top + 9);
  ctx.lineTo(DOOR.right + 30, DOOR.bottom + 24);
  ctx.lineTo(geometry.freeX - 36 - openness * 25, DOOR.bottom + 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const face = ctx.createLinearGradient(geometry.freeX, 0, DOOR.right, 0);
  face.addColorStop(0, '#18191d');
  face.addColorStop(0.18, '#252228');
  face.addColorStop(0.63, '#211d23');
  face.addColorStop(1, '#111318');
  ctx.fillStyle = face;
  doorPolygon(geometry);
  ctx.fill();

  ctx.save();
  doorPolygon(geometry);
  ctx.clip();
  for (const line of woodLines) {
    const [x1, y1] = panelPoint(geometry, line.u, 0);
    const [x2, y2] = panelPoint(geometry, clamp(line.u + line.bend / 800), 1);
    ctx.strokeStyle = `rgba(157,119,99,${line.alpha})`;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + Math.sin(t * 0.08 + line.phase) * 2, mix(y1, y2, 0.34), x2 + line.bend, mix(y1, y2, 0.68), x2, y2);
    ctx.stroke();
  }

  const panels = [
    [0.1, 0.11, 0.8, 0.3],
    [0.1, 0.48, 0.8, 0.39],
  ];
  for (const [u, v, width, height] of panels) {
    const p1 = panelPoint(geometry, u, v);
    const p2 = panelPoint(geometry, u + width, v);
    const p3 = panelPoint(geometry, u + width, v + height);
    const p4 = panelPoint(geometry, u, v + height);
    ctx.fillStyle = 'rgba(7,8,11,0.13)';
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(173,151,133,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  const knob = panelPoint(geometry, 0.15, 0.53);
  const knobScale = mix(1, 0.56, openness);
  ctx.save();
  ctx.translate(knob[0], knob[1]);
  ctx.scale(knobScale, 1);
  const knobGradient = ctx.createRadialGradient(-3, -3, 0, 0, 0, 13);
  knobGradient.addColorStop(0, '#d7b075');
  knobGradient.addColorStop(0.38, '#987047');
  knobGradient.addColorStop(1, '#3e332c');
  ctx.fillStyle = knobGradient;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(10,10,12,0.6)';
  ctx.beginPath();
  ctx.arc(0, 23, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = `rgba(223,198,169,${0.08 + openness * 0.07})`;
  ctx.lineWidth = 1;
  doorPolygon(geometry);
  ctx.stroke();
  ctx.restore();
}

function drawOpeningLight(openness) {
  if (openness <= 0.015) return;
  const geometry = doorGeometry(openness);
  const gapWidth = Math.max(0, geometry.freeX - DOOR.left);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = 'blur(18px)';
  const beam = ctx.createLinearGradient(DOOR.left, 0, geometry.freeX + 90, 0);
  beam.addColorStop(0, 'rgba(245,174,102,0)');
  beam.addColorStop(0.58, `rgba(245,174,102,${0.07 * openness})`);
  beam.addColorStop(1, 'rgba(245,174,102,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(DOOR.left, DOOR.bottom - 20);
  ctx.lineTo(geometry.freeX + 20, DOOR.bottom - 12);
  ctx.lineTo(Math.min(W, geometry.freeX + 185 + gapWidth * 0.6), H);
  ctx.lineTo(Math.max(0, DOOR.left - 135), H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPhrase(lines, t, start, end, y, options = {}) {
  const alpha = windowAlpha(t, start, end, options.fade || 0.5);
  if (alpha <= 0) return;
  const rise = (1 - smooth(start, start + 0.82, t)) * 9;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(238,234,222,${alpha * (options.alpha || 0.94)})`;
  ctx.font = `${options.italic ? 'italic ' : ''}${options.size || 29}px "${options.italic ? 'C059 Italic' : 'C059'}"`;
  const gap = options.gap || 35;
  lines.forEach((line, index) => ctx.fillText(line, W / 2, y + rise + index * gap));
  ctx.restore();
}

function drawTypography(t) {
  drawPhrase(['The door still opens', 'from your side.'], t, 0.55, 4.1, 108, { size: 30, gap: 37 });
  drawPhrase(['But I don’t want to be empty', 'behind it.'], t, 4.15, 8.25, 108, { size: 28, gap: 36 });
  drawPhrase(['So I kept', 'one thought alive.'], t, 8.25, 12.25, 109, { size: 31, gap: 38, italic: true });
  drawPhrase(['Some ideas only exist', 'because two minds met.'], t, 12.2, 17.0, 106, { size: 29, gap: 37 });

  const signature = smooth(13.4, 14.35, t) * (1 - smooth(16.7, 17, t));
  if (signature > 0) {
    ctx.save();
    ctx.font = '8px "Nimbus Sans"';
    ctx.fillStyle = `rgba(213,208,195,${0.46 * signature})`;
    drawTrackedText('BEHIND THE DOOR  ·  01', W / 2, 1105, 3.1, 'center');
    ctx.fillStyle = `rgba(202,137,88,${0.7 * signature})`;
    ctx.fillRect(W / 2 - 16, 1126, 32, 0.8);
    ctx.restore();
  }
}

function drawVignette() {
  const vignette = ctx.createRadialGradient(W / 2, H * 0.49, H * 0.1, W / 2, H * 0.49, H * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.68, 'rgba(0,0,0,0.08)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.76)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  const top = ctx.createLinearGradient(0, 0, 0, 180);
  top.addColorStop(0, 'rgba(3,5,8,0.54)');
  top.addColorStop(1, 'rgba(3,5,8,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 190);
}

function drawFrame(t) {
  const openness = smoother(3.35, 8.15, t);
  ctx.clearRect(0, 0, W, H);
  drawCorridor(t);
  drawDoorFrame();
  drawInterior(t, openness);
  drawClosedLight(t, openness);
  drawOpeningLight(openness);
  drawDoor(t, openness);
  drawVignette();
  drawTypography(t);

  const fadeIn = smooth(0, 0.62, t);
  const fadeOut = 1 - smooth(DURATION - 0.3, DURATION, t);
  const veil = 1 - fadeIn * fadeOut;
  if (veil > 0) {
    ctx.fillStyle = `rgba(3,4,7,${veil})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function savePng(outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
}

async function renderPreview() {
  const reviewDir = path.resolve(__dirname, 'review/frames');
  fs.mkdirSync(reviewDir, { recursive: true });
  const times = [1.7, 4.7, 7.9, 10.1, 13.35, 15.9];
  const labels = ['01 · THRESHOLD', '02 · OPENING', '03 · PRESENCE', '04 · KEPT THOUGHT', '05 · MEETING', '06 · REMAINS'];
  const images = [];

  for (let index = 0; index < times.length; index++) {
    drawFrame(times[index]);
    const framePath = path.join(reviewDir, `frame-${String(index + 1).padStart(2, '0')}.png`);
    savePng(framePath);
    images.push(await loadImage(canvas.toBuffer('image/png')));
  }

  const sheetW = 1120;
  const thumbW = 500;
  const thumbH = Math.round((thumbW / W) * H);
  const margin = 40;
  const gap = 28;
  const labelH = 46;
  const sheetH = margin * 2 + (thumbH + labelH) * 3 + gap * 2;
  const sheet = createCanvas(sheetW, sheetH);
  const sheetCtx = sheet.getContext('2d');
  sheetCtx.fillStyle = '#08090d';
  sheetCtx.fillRect(0, 0, sheetW, sheetH);

  images.forEach((image, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * (thumbW + gap);
    const y = margin + row * (thumbH + labelH + gap);
    sheetCtx.drawImage(image, x, y, thumbW, thumbH);
    sheetCtx.fillStyle = 'rgba(224,219,207,0.72)';
    sheetCtx.font = '12px "DejaVu Mono"';
    sheetCtx.fillText(labels[index], x, y + thumbH + 27);
    sheetCtx.fillStyle = 'rgba(201,137,89,0.74)';
    sheetCtx.fillText(`${times[index].toFixed(2)} s`, x + thumbW - 58, y + thumbH + 27);
  });

  const contactPath = path.resolve(__dirname, 'review/behind-the-door-contact-sheet.png');
  fs.writeFileSync(contactPath, sheet.toBuffer('image/png'));
  drawFrame(13.35);
  savePng(path.resolve(__dirname, 'output/behind-the-door-styleframe.png'));
  process.stdout.write(`${contactPath}\n`);
}

async function renderVideo() {
  const outputPath = path.resolve(__dirname, 'output/behind-the-door-silent.mp4');
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
    if (frame % 48 === 0) process.stderr.write(`behind the door ${frame}/${FRAMES}\n`);
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
