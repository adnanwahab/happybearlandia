const width = 640;
const height = 265;
const middle = [width / 2, height / 2];
const sea = '#18353b';
const mint = '#b9ebcf';
const gold = '#f1cf83';
const line = '#5f9b9a';

function ellipse(ctx, x, y, rx, ry, fill = false) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) ctx.fill();
  else ctx.stroke();
}

function globe(ctx, hasOrigin) {
  const [x, y] = middle;
  ctx.strokeStyle = line;
  ellipse(ctx, x, y, 98, 98);
  ellipse(ctx, x, y, 68, 98);
  ellipse(ctx, x, y, 32, 98);
  ellipse(ctx, x, y, 98, 68);
  ellipse(ctx, x, y, 98, 32);
  if (hasOrigin) {
    ctx.fillStyle = gold;
    ellipse(ctx, x, y, 7, 7, true);
  }
}

function districtMap(ctx, points) {
  ctx.strokeStyle = '#31595e';
  for (let x = 40; x < width; x += 40) ctx.strokeRect(x, 0, .3, height);
  for (let y = 25; y < height; y += 25) ctx.strokeRect(0, y, width, .3);
  const located = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.z));
  if (!located.length) return;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const { x, z } of located) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  const scale = Math.min((width - 104) / Math.max(1, x1 - x0), (height - 65) / Math.max(1, z1 - z0));
  ctx.fillStyle = mint;
  for (const point of located) {
    ellipse(ctx, middle[0] + (point.x - (x0 + x1) / 2) * scale,
      middle[1] + (point.z - (z0 + z1) / 2) * scale, 6, 6, true);
  }
}

function polygon(ctx, points, color) {
  ctx.beginPath();
  for (const [x, y] of points) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function building(ctx, mapped) {
  if (!mapped) {
    ctx.strokeStyle = line;
    ctx.setLineDash([6, 5]);
    ellipse(ctx, ...middle, 98, 71);
    return;
  }
  polygon(ctx, [[256, 82], [338, 49], [398, 78], [316, 113]], '#b4d7c6');
  polygon(ctx, [[256, 82], [316, 113], [316, 211], [256, 179]], '#649989');
  polygon(ctx, [[316, 113], [398, 78], [398, 175], [316, 211]], '#84ad9c');
}

function network(ctx, count) {
  const [x, y] = middle;
  ctx.strokeStyle = line;
  for (let index = 0; index < count; index++) {
    const radians = index * Math.PI * 2 / count - Math.PI / 2;
    const px = x + Math.cos(radians) * 154;
    const py = y + Math.sin(radians) * 90;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.fillStyle = mint;
    ellipse(ctx, px, py, 6, 6, true);
  }
  ctx.fillStyle = gold;
  ellipse(ctx, x, y, 10, 10, true);
}

export function drawZoom(canvas, index, view) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, width, height);
  if (view.rank === 0) globe(ctx, Boolean(index.origin));
  if (view.rank === 1) districtMap(ctx, [...index.districts.values()]);
  if (view.rank === 2) districtMap(ctx, [...view.district.anchors.values()]);
  if (view.rank === 3) building(ctx, Boolean(view.anchor.buildingId));
  if (view.rank === 4) network(ctx, Math.min(view.household.residents.length, 12));
  if (view.rank === 5) network(ctx, Math.min(view.resident.links.length, 12));
  ctx.restore();
}
