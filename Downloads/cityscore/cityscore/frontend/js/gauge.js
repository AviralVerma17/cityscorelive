// Renders an analog instrument-panel dial for the overall 0-100
// score: a swept arc, tick marks, and a needle that animates to its
// resting position. This is the page's signature element.

const MIN_ANGLE = -120; // degrees, needle position at score 0
const MAX_ANGLE = 120; // degrees, needle position at score 100

function scoreToAngle(score) {
  const clamped = Math.max(0, Math.min(100, score));
  return MIN_ANGLE + (clamped / 100) * (MAX_ANGLE - MIN_ANGLE);
}

function bandColor(score) {
  if (score >= 75) return 'var(--good)';
  if (score >= 55) return 'var(--fair)';
  if (score >= 35) return 'var(--warn)';
  return 'var(--poor)';
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function renderGauge(container, score) {
  const cx = 110;
  const cy = 120;
  const r = 92;

  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const angle = MIN_ANGLE + (i / 10) * (MAX_ANGLE - MIN_ANGLE);
    const outer = polarToCartesian(cx, cy, r + 2, angle);
    const inner = polarToCartesian(cx, cy, r - (i % 5 === 0 ? 14 : 8), angle);
    ticks.push(`<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" class="gauge-tick" />`);
  }

  const needleAngle = scoreToAngle(score);
  const color = bandColor(score);

  container.innerHTML = `
    <svg viewBox="0 0 220 150" class="gauge-svg" role="img" aria-label="Overall score ${score} out of 100">
      <path d="${describeArc(cx, cy, r, MIN_ANGLE, MAX_ANGLE)}" class="gauge-track" />
      <path d="${describeArc(cx, cy, r, MIN_ANGLE, needleAngle)}" class="gauge-progress" style="stroke:${color}" />
      ${ticks.join('')}
      <g class="gauge-needle" style="--needle-angle:${needleAngle}deg" transform-origin="${cx}px ${cy}px">
        <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r + 20}" class="gauge-needle-line" />
        <circle cx="${cx}" cy="${cy}" r="6" class="gauge-hub" />
      </g>
    </svg>
  `;
}
