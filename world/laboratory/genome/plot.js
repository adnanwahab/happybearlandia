export function mountPlot(metrics) {
  const select = document.querySelector('#plot-metric');
  const slider = document.querySelector('#plot-month');
  const canvas = document.querySelector('#plot');
  const value = document.querySelector('#plot-value');
  const ctx = canvas.getContext('2d');
  let series;
  select.replaceChildren(...Object.entries(metrics).map(([key, label]) => new Option(label, key)));
  const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const colors = { baseline: '#84c9f4', edited: '#c8ec9c' };

  function draw() {
    const key = select.value;
    const month = Number(slider.value);
    value.textContent = `Month ${month} · Baseline ${format.format(series.baseline[month][key])} · Edited ${format.format(series.edited[month][key])}`;
    if (!ctx) return;

    const values = [...series.baseline, ...series.edited].map(row => row[key]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.08 || 1;
    const { width, height } = canvas;
    const start = 86;
    const bottom = height - 30;
    const x = index => start + index * (width - start - 18) / Number(slider.max);
    const y = amount => bottom - (amount - min + padding) * (bottom - 18) / (max - min + padding * 2);

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#52675e';
    ctx.fillStyle = '#b9cbbf';
    ctx.font = '15px system-ui';
    for (const amount of [...new Set([min, (min + max) / 2, max])]) {
      ctx.beginPath();
      ctx.moveTo(start, y(amount));
      ctx.lineTo(width - 18, y(amount));
      ctx.stroke();
      ctx.fillText(format.format(amount), 8, y(amount) + 4, start - 14);
    }
    ctx.fillText('Month 0', start, height - 8);
    ctx.fillText('Month ' + slider.max, width - 90, height - 8);

    for (const [name, rows] of Object.entries(series)) {
      ctx.strokeStyle = colors[name];
      ctx.lineWidth = 2.5;
      ctx.setLineDash(name === 'baseline' ? [7, 6] : []);
      ctx.beginPath();
      for (const [index, row] of rows.entries()) ctx.lineTo(x(index), y(row[key]));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e7efe5';
    ctx.beginPath();
    ctx.moveTo(x(month), 18);
    ctx.lineTo(x(month), bottom);
    ctx.stroke();
  }

  select.addEventListener('change', draw);
  slider.addEventListener('input', draw);
  return result => {
    series = result;
    slider.max = series.edited.length - 1;
    slider.value = slider.max;
    draw();
  };
}
