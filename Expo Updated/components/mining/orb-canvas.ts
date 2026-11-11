import type { Frame } from './ThinkingOrb';

/** Draw directly into one canvas: no React updates or per-particle DOM nodes. */
export function drawOrb(ctx: CanvasRenderingContext2D, frame: Frame, size: number, dark: boolean) {
  ctx.clearRect(0, 0, size, size);
  const center = size / 2;
  const ink = dark ? '255,255,255' : '20,20,28';
  const circle = (x: number, y: number, r: number, fill: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const radial = (radius: number, stops: [number, string][]) => {
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    for (const [position, color] of stops) gradient.addColorStop(position, color);
    circle(center, center, radius, gradient);
  };
  radial(size * 0.36 * 1.55, dark
    ? [[0, 'rgba(255,255,255,.06)'], [.35, 'rgba(255,255,255,.02)'], [.7, 'rgba(255,255,255,.005)'], [1, 'rgba(0,0,0,0)']]
    : [[0, 'rgba(0,0,0,.05)'], [.4, 'rgba(0,0,0,.015)'], [.8, 'rgba(0,0,0,.003)'], [1, 'rgba(255,255,255,0)']]);
  ctx.lineCap = 'round';
  for (const d of frame.dots) {
    if (d.trail) {
      ctx.beginPath();
      ctx.moveTo(d.trail[0], d.trail[1]);
      ctx.lineTo(d.x, d.y);
      ctx.strokeStyle = `rgba(${ink},${d.a * (dark ? .09 : .11)})`;
      ctx.lineWidth = Math.max(d.r * .5, .35);
      ctx.stroke();
    }
    if (d.glow) circle(d.x, d.y, d.r * 2.6, dark
      ? `rgba(255,255,255,${d.a * .1})` : `rgba(0,0,0,${d.a * .055})`);
    circle(d.x, d.y, d.r, `rgba(${ink},${d.a})`);
    if (d.spark) {
      ctx.beginPath();
      ctx.moveTo(d.x - d.spark, d.y);
      ctx.lineTo(d.x + d.spark, d.y);
      ctx.moveTo(d.x, d.y - d.spark);
      ctx.lineTo(d.x, d.y + d.spark);
      ctx.strokeStyle = `rgba(${ink},${d.a * .72})`;
      ctx.lineWidth = .4;
      ctx.stroke();
    }
  }
  const bloom = frame.coreRadius * 4.2;
  radial(bloom + size * .14, dark
    ? [[.5, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']]
    : [[.5, 'rgba(0,0,0,.15)'], [1, 'rgba(0,0,0,0)']]);
  radial(bloom, dark
    ? [[0, 'rgba(255,255,255,.92)'], [.18, 'rgba(255,255,255,.55)'], [.4, 'rgba(240,240,248,.18)'], [.7, 'rgba(220,220,235,.04)'], [1, 'rgba(0,0,0,0)']]
    : [[0, 'rgba(18,18,24,.92)'], [.2, 'rgba(35,35,45,.5)'], [.45, 'rgba(70,70,85,.16)'], [.75, 'rgba(100,100,120,.03)'], [1, 'rgba(255,255,255,0)']]);
  radial(frame.coreRadius * .95, dark
    ? [[0, 'rgba(255,255,255,.98)'], [.45, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]
    : [[0, 'rgba(10,10,15,.98)'], [.45, 'rgba(30,30,40,.45)'], [1, 'rgba(0,0,0,0)']]);
}
