import { getCities, getMethodology, submitRating, isOffline } from './api.js';
import { renderMap } from './map.js';
import { renderGauge } from './gauge.js';
import { CATEGORY_META } from './data.js';
import { MODES, DEFAULT_MODE } from './modes.js';
import { getFavorites, isFavorite, toggleFavorite } from './favorites.js';

const state = {
  cities: [],
  selectedSlug: null,
  offline: false,
  mode: DEFAULT_MODE,
  favorites: new Set(getFavorites()),
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
  modeSwitch: document.getElementById('mode-switch'),
  modeNote: document.getElementById('mode-note'),
  favoriteToggle: document.getElementById('favorite-toggle'),
  favoritesBtn: document.getElementById('favorites-btn'),
  favoritesCount: document.getElementById('favorites-count'),
  favoritesPanel: document.getElementById('favorites-panel'),
  favoritesClose: document.getElementById('favorites-close'),
  favoritesList: document.getElementById('favorites-list'),
  favoritesEmpty: document.getElementById('favorites-empty'),
  rankingsBtn: document.getElementById('rankings-btn'),
  rankingsPanel: document.getElementById('rankings-panel'),
  rankingsClose: document.getElementById('rankings-close'),
  rankingsList: document.getElementById('rankings-list'),
  rankingsModeLabel: document.getElementById('rankings-mode-label'),
  scorePanel: document.querySelector('.score-panel'),
  categoryPanel: document.querySelector('.category-panel'),
};

const MODE_ORDER = ['student', 'professional', 'family'];

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

  const favorited = state.favorites.has(city.slug);
  el.favoriteToggle.classList.toggle('active', favorited);
  el.favoriteToggle.setAttribute('aria-pressed', String(favorited));
  el.favoriteToggle.setAttribute('aria-label', favorited ? 'Remove from favorites' : 'Add to favorites');

  el.modeNote.textContent = `Scored for ${MODES[state.mode].label.toLowerCase()} priorities`;

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

  const weights = MODES[state.mode].weights;

  el.categoryGrid.innerHTML = Object.entries(CATEGORY_META)
    .map(([key, meta]) => {
      const data = city.categories[key] || { score: 0 };
      const pct = Math.round((data.score / 10) * 100);
      const rawValue = formatEnvValue(key, city);
      const isCrowd = meta.group === 'crowd';
      const weightPct = Math.round((weights[key] ?? meta.weight) * 100);

      return `
        <div class="category-card" tabindex="0">
          <div class="category-card-head">
            <span class="category-label">${meta.label}</span>
            <span class="category-score">${data.score.toFixed(1)}</span>
          </div>
          <div class="category-bar"><div class="category-bar-fill" style="width:${pct}%"></div></div>
          <div class="category-detail">
            <span class="category-weight">${weightPct}% weight</span>
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

function renderFavoritesCount() {
  el.favoritesCount.textContent = String(state.favorites.size);
  el.favoritesCount.hidden = state.favorites.size === 0;
}

function renderAll() {
  renderMapPanel();
  renderScorePanel();
  renderCategoryCards();
  renderOfflineBanner();
  renderFavoritesCount();
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

// --- Mode switching ---------------------------------------------------

function reduceMotionPreferred() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setModeSwitchUI(mode) {
  const index = MODE_ORDER.indexOf(mode);
  el.modeSwitch.style.setProperty('--active-index', String(index));
  el.modeSwitch.querySelectorAll('.mode-btn').forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.setAttribute('aria-selected', String(active));
  });
}

async function selectMode(mode) {
  if (mode === state.mode || !MODES[mode]) return;
  state.mode = mode;
  setModeSwitchUI(mode);

  const morphTargets = [el.scorePanel, el.categoryPanel];
  if (!reduceMotionPreferred()) {
    morphTargets.forEach((elm) => elm.classList.add('morphing'));
  }

  const { cities, offline } = await getCities(state.mode);
  state.cities = cities;
  state.offline = offline || isOffline();
  renderAll();

  requestAnimationFrame(() => {
    morphTargets.forEach((elm) => elm.classList.remove('morphing'));
  });
}

el.modeSwitch.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  selectMode(btn.dataset.mode);
});

// --- Favorites --------------------------------------------------------

function updateFavoriteToggleUI() {
  const city = currentCity();
  if (!city) return;
  const favorited = state.favorites.has(city.slug);
  el.favoriteToggle.classList.toggle('active', favorited);
  el.favoriteToggle.setAttribute('aria-pressed', String(favorited));
  el.favoriteToggle.setAttribute('aria-label', favorited ? 'Remove from favorites' : 'Add to favorites');
}

el.favoriteToggle.addEventListener('click', () => {
  const city = currentCity();
  if (!city) return;
  const nowFavorited = toggleFavorite(city.slug);
  if (nowFavorited) {
    state.favorites.add(city.slug);
  } else {
    state.favorites.delete(city.slug);
  }
  updateFavoriteToggleUI();
  renderFavoritesCount();
  if (el.favoritesPanel.open) renderFavoritesList();
});

function renderCityListRow(city, { showRank, rank } = {}) {
  const favorited = state.favorites.has(city.slug);
  return `
    <li class="city-list-row" data-slug="${city.slug}">
      ${showRank ? `<span class="city-rank">#${rank}</span>` : ''}
      <button class="city-row-star ${favorited ? 'active' : ''}" data-slug="${city.slug}"
              aria-pressed="${favorited}" aria-label="${favorited ? 'Remove from favorites' : 'Add to favorites'}" type="button">
        <span aria-hidden="true">&#9733;</span>
      </button>
      <span class="city-row-name">${city.name}${city.state ? ', ' + city.state : ''} <span class="city-row-country">${city.country}</span></span>
      <span class="city-row-score">${city.overallScore}</span>
    </li>
  `;
}

function wireCityListInteractions(listEl, onRowClick) {
  listEl.addEventListener('click', (e) => {
    const starBtn = e.target.closest('.city-row-star');
    if (starBtn) {
      const slug = starBtn.dataset.slug;
      const nowFavorited = toggleFavorite(slug);
      if (nowFavorited) state.favorites.add(slug);
      else state.favorites.delete(slug);
      renderFavoritesCount();
      updateFavoriteToggleUI();
      onRowClick(null, true); // re-render the open list in place
      return;
    }
    const row = e.target.closest('.city-list-row');
    if (row) onRowClick(row.dataset.slug, false);
  });
}

function renderRankingsList() {
  const sorted = [...state.cities].sort((a, b) => b.overallScore - a.overallScore);
  el.rankingsList.innerHTML = sorted
    .map((city, i) => renderCityListRow(city, { showRank: true, rank: i + 1 }))
    .join('');
  el.rankingsModeLabel.textContent = `\u2014 ${MODES[state.mode].label} mode`;
}

function renderFavoritesList() {
  const favorited = state.cities
    .filter((c) => state.favorites.has(c.slug))
    .sort((a, b) => b.overallScore - a.overallScore);

  el.favoritesEmpty.hidden = favorited.length > 0;
  el.favoritesList.innerHTML = favorited.map((city) => renderCityListRow(city)).join('');
}

wireCityListInteractions(el.rankingsList, (slug, refreshOnly) => {
  if (refreshOnly) {
    renderRankingsList();
    return;
  }
  selectCity(slug);
  el.rankingsPanel.close();
});

wireCityListInteractions(el.favoritesList, (slug, refreshOnly) => {
  if (refreshOnly) {
    renderFavoritesList();
    return;
  }
  selectCity(slug);
  el.favoritesPanel.close();
});

el.rankingsBtn.addEventListener('click', () => {
  renderRankingsList();
  el.rankingsPanel.showModal();
});
el.rankingsClose.addEventListener('click', () => el.rankingsPanel.close());

el.favoritesBtn.addEventListener('click', () => {
  renderFavoritesList();
  el.favoritesPanel.showModal();
});
el.favoritesClose.addEventListener('click', () => el.favoritesPanel.close());

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
    const refreshed = await getCities(state.mode);
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
  const data = await getMethodology(state.mode);
  const rows = Object.entries(data.weights)
    .map(([key, weight]) => {
      const meta = CATEGORY_META[key];
      return `<tr><td>${meta ? meta.label : key}</td><td>${Math.round(weight * 100)}%</td><td>${meta?.group === 'crowd' ? 'Crowd-submitted' : 'Fixed source'}</td></tr>`;
    })
    .join('');

  el.methodologyBody.innerHTML = `
    <p class="dialog-hint">Weights shown for <strong>${MODES[state.mode].label}</strong> mode &mdash; ${MODES[state.mode].description}</p>
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
  setModeSwitchUI(state.mode);
  const { cities, offline } = await getCities(state.mode);
  state.cities = cities;
  state.offline = offline || isOffline();
  state.selectedSlug = cities[0]?.slug || null;
  renderAll();
}

boot();
