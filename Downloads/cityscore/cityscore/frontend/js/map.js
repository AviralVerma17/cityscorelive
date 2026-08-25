// Real, pannable/zoomable map using Leaflet + free CARTO dark tiles
// (no API key required). Replaces the earlier abstract "radar" grid:
// with actual geography underneath, a hovering tooltip tells you
// exactly which city and country each dot belongs to, and drag/scroll
// only pans and zooms the map itself, not the page.

const BAND_COLOR = {
  good: '#4ade80',
  fair: '#a3e635',
  warn: '#f5a623',
  poor: '#f0555a',
};

function band(score) {
  if (score >= 75) return 'good';
  if (score >= 55) return 'fair';
  if (score >= 35) return 'warn';
  return 'poor';
}

let map = null;
let markersLayer = null;
let markersBySlug = {};
let lastSelectedSlug = null;

function ensureMap(container) {
  if (map) return;

  map = L.map(container, {
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 12,
    zoomControl: true,
    attributionControl: true,
  }).setView([20, 10], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

export function renderMap(container, cities, selectedSlug, onSelect) {
  ensureMap(container);

  markersLayer.clearLayers();
  markersBySlug = {};

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  cities.forEach((city) => {
    const isSelected = city.slug === selectedSlug;
    const marker = L.circleMarker([city.lat, city.lng], {
      radius: isSelected ? 9 : 6,
      color: isSelected ? '#4fd1c5' : '#0a0d10',
      weight: isSelected ? 2.5 : 1.5,
      fillColor: BAND_COLOR[band(city.overallScore)],
      fillOpacity: 0.92,
      className: 'city-marker',
    });

    marker.bindTooltip(
      `<strong>${city.name}</strong>${city.state ? ', ' + city.state : ''} \u00b7 ${city.country}<br>Score: ${city.overallScore}`,
      { direction: 'top', offset: [0, -8], className: 'city-tooltip' }
    );

    marker.on('click', () => onSelect(city.slug));
    marker.addTo(markersLayer);
    markersBySlug[city.slug] = marker;
  });

  // Only fly the view when the selection actually changed (e.g. from
  // search or a fresh page load) — never on a routine re-render (like
  // after a rating submission), so we don't yank the map out from
  // under someone who's mid-pan/zoom.
  if (selectedSlug && selectedSlug !== lastSelectedSlug) {
    const city = cities.find((c) => c.slug === selectedSlug);
    if (city) {
      map.flyTo([city.lat, city.lng], Math.max(map.getZoom(), 5), {
        duration: reduceMotion ? 0 : 0.7,
      });
    }
  }
  lastSelectedSlug = selectedSlug;
}
