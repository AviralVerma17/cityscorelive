import { getCities, getMethodology, submitRating, isOffline } from './api.js';
import { renderMap } from './map.js';
import { renderGauge } from './gauge.js';
import { CATEGORY_META } from './data.js';

const state = {
  cities: [],
  selectedSlug: null,
  offline: false,
};

const el = {
  map: document.getElementById('map'),
  gauge: document.getElementById('gauge'),
  cityName: document.getElementById('city-name'),
  cityMeta: document.getElementById('city-meta'),
  seedBadge: document.getElementById('seed-badge'),
  offlineBanner: document.getElementById('offline-banner'),
  categoryGrid: document.getElementById('category-grid'),
  search: document.getElementById('city-search'),
  searchResults: document.getElementById('search-results'),
  rateBtn: document.getElementById('rate-city-btn'),
  rateModal: document.getElementById('rate-modal'),
  rateForm: document.getElementById('rate-form'),
  rateCityLabel: document.getElementById('rate-city-label'),
  rateClose: document.getElementById('rate-close'),
  rateStatus: document.getElementById('rate-status'),
  methodologyBtn: document.getElementById('methodology-btn'),
  methodologyPanel: document.getElementById('methodology-panel'),
  methodologyClose: document.getElementById('methodology-close'),
  methodologyBody: document.getElementById('methodology-body'),
};

function currentCity() {
  return state.cities.find((c) => c.slug === state.selectedSlug) || state.cities[0];
}

function selectCity(slug) {
  state.selectedSlug = slug;
  renderAll();
}

function renderMapPanel() {
  renderMap(el.map, state.cities, state.selectedSlug, selectCity);
}

function renderScorePanel() {
  const city = currentCity();
  if (!city) return;

  el.cityName.textContent = city.name;
  el.cityMeta.textContent = [city.state, city.country].filter(Boolean).join(', ');
  el.seedBadge.hidden = !city.isSeedData;
  el.seedBadge.title = city.isSeedData
    ? 'No real submissions yet — showing seed data'
    : `${city.contributorCount} contributor${city.contributorCount === 1 ? '' : 's'}`;

  renderGauge(el.gauge, city.overallScore);
}

function formatEnvValue(category, city) {
  if (category === 'weather' && city.environment?.tempC != null) {
    return `${Math.round(city.environment.tempC)}\u00b0C`;
  }
  if (category === 'airQuality' && city.environment?.aqi != null) {
    return `AQI ${Math.round(city.environment.aqi)}`;
  }
  return null;
}

function renderCategoryCards() {
  const city = currentCity();
  if (!city) return;

  el.categoryGrid.innerHTML = Object.entries(CATEGORY_META)
    .map(([key, meta]) => {
      const data = city.categories[key] || { score: 0 };
      const pct = Math.round((data.score / 10) * 100);
      const rawValue = formatEnvValue(key, city);
      const isCrowd = meta.group === 'crowd';

      return `
        <div class="category-card" tabindex="0">
          <div class="category-card-head">
            <span class="category-label">${meta.label}</span>
            <span class="category-score">${data.score.toFixed(1)}</span>
          </div>
          <div class="category-bar"><div class="category-bar-fill" style="width:${pct}%"></div></div>
          <div class="category-detail">
            <span class="category-weight">${Math.round(meta.weight * 100)}% weight</span>
            ${
              isCrowd
                ? `<span class="category-source">${city.contributorCount} contributor${city.contributorCount === 1 ? '' : 's'}</span>`
                : rawValue
                  ? `<span class="category-source">${rawValue} \u00b7 ${city.environment?.source === 'live' ? 'live' : 'seed'}</span>`
                  : ''
            }
          </div>
          <div class="category-updated">${
            isCrowd
              ? city.contributorCount ? 'Updated with each new rating' : 'Awaiting first submission'
              : city.environment?.fetchedAt
                ? `Refreshed ${new Date(city.environment.fetchedAt + 'Z').toLocaleString()}`
                : 'Not yet refreshed'
          }</div>
        </div>
      `;
    })
    .join('');
}

function renderOfflineBanner() {
  el.offlineBanner.hidden = !state.offline;
}

function renderAll() {
  renderMapPanel();
  renderScorePanel();
  renderCategoryCards();
  renderOfflineBanner();
}

// --- Search ---------------------------------------------------------

function renderSearchResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    el.searchResults.innerHTML = '';
    el.searchResults.hidden = true;
    return;
  }
  const matches = state.cities
    .filter((c) => `${c.name} ${c.state || ''}`.toLowerCase().includes(q))
    .slice(0, 8);

  el.searchResults.innerHTML = matches
    .map((c) => `<li data-slug="${c.slug}">${c.name}${c.state ? ', ' + c.state : ''}</li>`)
    .join('');
  el.searchResults.hidden = matches.length === 0;
}

el.search.addEventListener('input', (e) => renderSearchResults(e.target.value));
el.searchResults.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  selectCity(li.dataset.slug);
  el.search.value = '';
  renderSearchResults('');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) {
    el.searchResults.hidden = true;
  }
});

// --- Rating modal -----------------------------------------------------

function openRateModal() {
  const city = currentCity();
  el.rateCityLabel.textContent = city.name;
  el.rateStatus.textContent = '';
  el.rateStatus.className = 'form-status';
  el.rateForm.reset();
  el.rateModal.showModal();
}

el.rateBtn.addEventListener('click', openRateModal);
el.rateClose.addEventListener('click', () => el.rateModal.close());

el.rateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const city = currentCity();
  const formData = new FormData(el.rateForm);
  const payload = {
    safety: Number(formData.get('safety')),
    traffic: Number(formData.get('traffic')),
    transport: Number(formData.get('transport')),
    cleanliness: Number(formData.get('cleanliness')),
    comment: formData.get('comment')?.toString().trim() || undefined,
  };

  const submitBtn = el.rateForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  el.rateStatus.textContent = 'Submitting\u2026';
  el.rateStatus.className = 'form-status';

  try {
    const result = await submitRating(city.slug, payload);
    el.rateStatus.textContent = result.message;
    el.rateStatus.className = 'form-status success';
    const refreshed = await getCities();
    state.cities = refreshed.cities;
    renderAll();
    setTimeout(() => el.rateModal.close(), 1200);
  } catch (err) {
    el.rateStatus.textContent = err.details
      ? err.details.map((d) => d.message).join(' ')
      : err.message;
    el.rateStatus.className = 'form-status error';
  } finally {
    submitBtn.disabled = false;
  }
});

// --- Methodology panel --------------------------------------------------

async function openMethodology() {
  const data = await getMethodology();
  const rows = Object.entries(data.weights)
    .map(([key, weight]) => {
      const meta = CATEGORY_META[key];
      return `<tr><td>${meta ? meta.label : key}</td><td>${Math.round(weight * 100)}%</td><td>${meta?.group === 'crowd' ? 'Crowd-submitted' : 'Fixed source'}</td></tr>`;
    })
    .join('');

  el.methodologyBody.innerHTML = `
    <table class="methodology-table">
      <thead><tr><th>Category</th><th>Weight</th><th>Source</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <ul class="methodology-explanation">
      ${data.explanation.map((line) => `<li>${line}</li>`).join('')}
    </ul>
  `;
  el.methodologyPanel.showModal();
}

el.methodologyBtn.addEventListener('click', openMethodology);
el.methodologyClose.addEventListener('click', () => el.methodologyPanel.close());

// --- Boot -----------------------------------------------------------

async function boot() {
  const { cities, offline } = await getCities();
  state.cities = cities;
  state.offline = offline || isOffline();
  state.selectedSlug = cities[0]?.slug || null;
  renderAll();
}

boot();
