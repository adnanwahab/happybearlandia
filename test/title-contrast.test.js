import { test, expect } from 'bun:test';

const rgb = hex => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = channels => channels.reduce((sum, value, i) => sum +
  [0.2126, 0.7152, 0.0722][i] * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4), 0);

test('animated homepage title retains readable contrast throughout its rainbow', async () => {
  const html = await Bun.file(new URL('../index.html', import.meta.url)).text();
  const background = rgb(html.match(/:root\s*\{[^}]*background:\s*#([\da-f]{6})/i)[1]);
  const gradient = html.match(/\.launch h1\s*\{\s*background: linear-gradient\(([^;]+)\);/)[1];
  const colors = [...gradient.matchAll(/#([\da-f]{6})/gi)].map(match => rgb(match[1]));
  expect(colors.length).toBeGreaterThanOrEqual(2);
  let minimum = Infinity;
  for (let stop = 1; stop < colors.length; stop++) {
    for (let step = 0; step <= 100; step++) {
      const input = colors[stop - 1].map((v, i) => v + (colors[stop][i] - v) * step / 100);
      for (let degrees = 0; degrees <= 360; degrees++) {
        const c = Math.cos(degrees * Math.PI / 180), s = Math.sin(degrees * Math.PI / 180);
        // CSS Filter Effects hueRotate matrix, applied to sRGB, with output clamping.
        const matrix = [
          [.213 + .787*c - .213*s, .715 - .715*c - .715*s, .072 - .072*c + .928*s],
          [.213 - .213*c + .143*s, .715 + .285*c + .140*s, .072 - .072*c - .283*s],
          [.213 - .213*c - .787*s, .715 - .715*c + .715*s, .072 + .928*c + .072*s],
        ];
        const output = matrix.map(row => Math.max(0, Math.min(1, row.reduce((sum, v, i) => sum + v * input[i], 0))));
        minimum = Math.min(minimum, (luminance(output) + .05) / (luminance(background) + .05));
      }
    }
  }
  expect(minimum).toBeGreaterThanOrEqual(4.5);
});
