// Favorites are a personal, browser-local preference — not something
// that needs a backend or an account, so they live in localStorage
// the same way seed-mode ratings used to before the API existed.

const STORAGE_KEY = 'cityscore:favorites';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(slugs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // Storage can fail (private browsing, quota, disabled) — favoriting
    // is a nice-to-have, so fail silently rather than break the app.
  }
}

export function getFavorites() {
  return readAll();
}

export function isFavorite(slug) {
  return readAll().includes(slug);
}

/** Toggles favorite status for a slug; returns the new boolean state. */
export function toggleFavorite(slug) {
  const current = readAll();
  const idx = current.indexOf(slug);
  if (idx === -1) {
    current.push(slug);
    writeAll(current);
    return true;
  }
  current.splice(idx, 1);
  writeAll(current);
  return false;
}
