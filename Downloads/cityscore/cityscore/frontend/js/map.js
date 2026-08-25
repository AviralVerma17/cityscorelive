// A self-contained "radar" map: no tile server, no API key, no
// network dependency. Cities are plotted with a simple equirectangular
// projection onto a dark panel with a graticule, so the whole app
// works completely offline (fitting, since the fixed-source data is
// seeded in this build anyway).

function project(lat, lng, width, height) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

function bandClass(score) {
  if (score >= 75) return 'good';
  if (score >= 55) return 'fair';
  if (score >= 35) return 'warn';
  return 'poor';
}

export function renderMap(container, cities, selectedSlug, onSelect) {
  const width = 1000;
  const height = 520;

  const graticule = [];
  for (let lng = -180; lng <= 180; lng += 30) {
    const { x } = project(0, lng, width, height);
    graticule.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" class="grid-line" />`);
  }
  for (let lat = -60; lat <= 90; lat += 30) {
    const { y } = project(lat, 0, width, height);
    graticule.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" class="grid-line" />`);
  }

  const markers = cities
    .map((city) => {
      const { x, y } = project(city.lat, city.lng, width, height);
      const selected = city.slug === selectedSlug;
      return `
        <g class="marker ${bandClass(city.overallScore)} ${selected ? 'selected' : ''}"
           data-slug="${city.slug}" transform="translate(${x},${y})" tabindex="0" role="button"
           aria-label="${city.name}, score ${city.overallScore}">
          ${selected ? '<circle r="16" class="marker-ring" />' : ''}
          <circle r="5" class="marker-dot" />
        </g>
      `;
    })
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="map-svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="sweepFade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" class="map-bg" />
      ${graticule.join('')}
      <g class="sweep-group">
        <circle cx="${width / 2}" cy="${height / 2}" r="${Math.max(width, height) / 1.4}" fill="url(#sweepFade)" class="sweep" />
      </g>
      ${markers}
    </svg>
  `;

  container.querySelectorAll('.marker').forEach((el) => {
    el.addEventListener('click', () => onSelect(el.dataset.slug));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(el.dataset.slug);
      }
    });
  });
}
