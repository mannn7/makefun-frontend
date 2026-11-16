// make.fun's public API: read-only GET, open to any origin (CORS).
// Answers are cached in memory and revalidated with ETags: the API's ETags
// are bound to the minute, so an If-None-Match inside the same minute
// answers 304 and costs nothing. Fresh data is at most a minute old, and
// a view never waits on a request it already made.

const API = 'https://make.fun/api';
const TTL_MS = 60_000;

const cache = new Map(); // path -> { etag, data, at }
let requests = 0;
let revalidated = 0;

/** One cached GET of a path below /api. Throws an Error with .status on HTTP errors. */
export async function get(path) {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && now - hit.at < TTL_MS) return hit.data;
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  requests += 1;
  const res = await fetch(API + path, { headers });
  if (res.status === 304 && hit) {
    revalidated += 1;
    hit.at = now;
    return hit.data;
  }
  if (!res.ok) {
    const err = new Error(`make.fun answered ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  cache.set(path, { etag: res.headers.get('etag'), data, at: now });
  return data;
}

/** How much the app has asked the API for (shown nowhere; for debugging). */
export function apiStats() {
  return { requests, revalidated, cached: cache.size };
}

/** The board: open bounties with their live pots, fees, deadlines and entries. */
export const getBoard = () => get('/competitions?status=open&activity=times');

/** Site-wide totals for the board's stat strip. */
export const getStats = () => get('/activity/stats');

/** One bounty, by its slug: summary, description, rules, live rewards, entries. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard. view is 'performance' (the default) or 'overall'. */
export const getLeaderboard = (slug, view) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard${view ? `?view=${encodeURIComponent(view)}` : ''}`);

/** An account's public profile, by its handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
