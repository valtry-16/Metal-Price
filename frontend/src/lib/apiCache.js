/**
 * Simple in-memory API response cache.
 * Since metal prices are only updated by cron jobs, we cache responses
 * to avoid redundant network calls when navigating between pages.
 */

const cache = {};
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch with caching. Returns cached data if still fresh, otherwise
 * makes a real fetch and caches the result.
 * @param {string} url - The URL to fetch
 * @param {number} [ttl] - Cache TTL in ms (default: 5 min)
 * @returns {Promise<any|null>} Parsed JSON or null on error
 */
export async function cachedFetch(url, ttl = DEFAULT_TTL) {
  const now = Date.now();
  const entry = cache[url];

  if (entry && now - entry.time < ttl) {
    return entry.data;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    cache[url] = { data, time: now };
    return data;
  } catch {
    return null;
  }
}

/** Clear cached entry for a specific URL or all entries */
export function clearCache(url) {
  if (url) {
    delete cache[url];
  } else {
    Object.keys(cache).forEach((k) => delete cache[k]);
  }
}
