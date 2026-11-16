// make.fun frontend: hash routes, live data, in-place updates.
//
//   #/                              the bounty board
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard
//   #/u/<handle>                    an account's public profile
//
// window.__shotReady is false while a route loads and true once its data
// has rendered, so a screenshot script knows when to capture.

import { getBoard, getStats, getBounty, getLeaderboard, getProfile } from './api.js';
import { boardView, boardCards, bountyView, rulesHtml, leaderboardView, profileView } from './views.js';
import { pot, num, timeLeftTicking, timeLeft, isOpen } from './format.js';

const app = document.getElementById('app');
const updatedEl = document.getElementById('updated');

let route = null; // { kind, slug?, handle?, view? }
let boardItems = [];
let boardFilter = 'all';
let boardSort = 'pot';
let boardQuery = '';
let tickTimer = null;
let refreshTimer = null;

function setUpdated() {
  if (updatedEl) updatedEl.textContent = `updated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

/** Every countdown on screen, ticked in place once a second. */
function tick() {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    el.textContent = timeLeftTicking(el.getAttribute('data-deadline'));
  }
  for (const el of document.querySelectorAll('[data-left]')) {
    const b = boardItems.find((x) => x.slug === el.getAttribute('data-left'));
    if (b) el.textContent = timeLeft(b.deadline);
  }
}

function startTimers() {
  if (tickTimer) return;
  tickTimer = setInterval(tick, 1000);
  refreshTimer = setInterval(refreshCurrent, 60_000);
}

/** Re-fetch the current route's data and patch the numbers in place. */
async function refreshCurrent() {
  if (!route) return;
  try {
    if (route.kind === 'board') {
      const data = await getBoard();
      boardItems = data.items;
      patchBoard();
      setUpdated();
    } else if (route.kind === 'bounty') {
      const b = await getBounty(route.slug);
      for (const el of document.querySelectorAll(`[data-pot="${CSS.escape(route.slug)}"]`)) el.textContent = `${pot(b)} `;
      for (const el of document.querySelectorAll(`[data-entries="${CSS.escape(route.slug)}"]`)) el.textContent = num(b.submissionCount);
      setUpdated();
    }
  } catch {
    // A failed refresh leaves the last good data on screen.
  }
}

/* ---------------------------------------------------------------- board */

function filteredBoard() {
  let items = boardItems.slice();
  const now = Date.now();
  if (boardFilter === 'open') items = items.filter((b) => isOpen(b));
  else if (boardFilter === 'soon') items = items.filter((b) => isOpen(b) && new Date(b.deadline).getTime() - now < 86400000);
  else if (boardFilter === 'ended') items = items.filter((b) => !isOpen(b));
  if (boardQuery) {
    const q = boardQuery.toLowerCase();
    items = items.filter((b) =>
      [b.title, b.slug, b.category, b.sponsor?.name, ...(b.skills || [])].join(' ').toLowerCase().includes(q));
  }
  const byPot = (a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0);
  const byClosing = (a, b) => new Date(a.deadline) - new Date(b.deadline);
  const byEntries = (a, b) => Number(b.submissionCount ?? 0) - Number(a.submissionCount ?? 0);
  const byTitle = (a, b) => String(a.title).localeCompare(String(b.title));
  items.sort(boardSort === 'closing' ? byClosing : boardSort === 'entries' ? byEntries : boardSort === 'title' ? byTitle : byPot);
  return items;
}

function patchBoard() {
  const list = document.getElementById('board-list');
  if (!list) return;
  const items = filteredBoard();
  const known = [...list.querySelectorAll('.card')].map((c) => c.getAttribute('data-slug'));
  const wanted = items.map((b) => b.slug);
  const sameOrder = known.length === wanted.length && known.every((s, i) => s === wanted[i]);
  if (sameOrder) {
    // Same bounties: update the live numbers in place, no rebuild.
    for (const b of items) {
      const card = list.querySelector(`[data-slug="${CSS.escape(b.slug)}"]`);
      if (!card) continue;
      const potEl = card.querySelector('[data-pot]');
      if (potEl) potEl.childNodes[0].textContent = `${pot(b)} `;
      const leftEl = card.querySelector('[data-left]');
      if (leftEl) leftEl.textContent = timeLeft(b.deadline);
      const entEl = card.querySelector('[data-entries]');
      if (entEl) entEl.textContent = `${num(b.submissionCount)} entries`;
    }
  } else {
    list.innerHTML = boardCards(items);
  }
  const count = document.getElementById('board-count');
  if (count) count.textContent = `${items.length} of ${boardItems.length} bounties`;
}

function wireBoard() {
  const search = document.getElementById('board-search');
  if (search) search.addEventListener('input', () => { boardQuery = search.value.trim(); patchBoard(); });
  const sort = document.getElementById('board-sort');
  if (sort) sort.addEventListener('change', () => { boardSort = sort.value; patchBoard(); });
  const filters = document.getElementById('board-filters');
  if (filters) filters.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-filter]');
    if (!btn) return;
    boardFilter = btn.getAttribute('data-filter');
    for (const c of filters.querySelectorAll('[data-filter]')) c.classList.toggle('on', c === btn);
    patchBoard();
  });
}

/* -------------------------------------------------------------- routes */

function errorView(message, retry) {
  return `<div class="error"><h2>Could not load this page</h2><p>${message}</p>
  <p><button class="btn" type="button" id="retry-btn">Try again</button></p></div>`;
}

function wireRetry() {
  const btn = document.getElementById('retry-btn');
  if (btn) btn.addEventListener('click', render);
}

async function renderBoard() {
  const [data, stats] = await Promise.all([getBoard(), getStats().catch(() => null)]);
  boardItems = data.items;
  app.innerHTML = boardView(data, stats);
  wireBoard();
  patchBoard();
}

async function renderBounty(slug) {
  const b = await getBounty(slug);
  if (!b || !b.slug) throw Object.assign(new Error('That bounty does not exist.'), { status: 404 });
  document.title = `${b.title} | make.fun`;
  let lb = null;
  try { lb = await getLeaderboard(slug); } catch { lb = null; }
  app.innerHTML = bountyView(b, lb);
  const rulesBox = document.getElementById('rules-box');
  if (rulesBox) rulesBox.addEventListener('toggle', () => {
    if (rulesBox.open && !rulesBox.dataset.done) {
      document.getElementById('rules-body').innerHTML = rulesHtml(b);
      rulesBox.dataset.done = '1';
    }
  });
}

async function renderLeaderboard(slug, view) {
  const [lb, bounty] = await Promise.all([
    getLeaderboard(slug, view),
    getBounty(slug).catch(() => null),
  ]);
  document.title = `Leaderboard — ${lb.competition?.title || slug} | make.fun`;
  app.innerHTML = leaderboardView(lb, slug, view, bounty);
  const filter = document.getElementById('lb-filter');
  if (filter) filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    for (const row of document.querySelectorAll('#lb-body tr')) {
      row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
    }
  });
  app.querySelectorAll('[data-view]').forEach((btn) => btn.addEventListener('click', () => {
    location.hash = `#/bounty/${encodeURIComponent(slug)}/leaderboard?view=${btn.getAttribute('data-view')}`;
  }));
}

async function renderProfile(handle) {
  const p = await getProfile(handle);
  if (!p || !p.handle) throw Object.assign(new Error('That account does not exist.'), { status: 404 });
  document.title = `${p.display_name || p.handle} (@${p.handle}) | make.fun`;
  app.innerHTML = profileView(p);
  app.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.getAttribute('data-copy'));
      btn.textContent = 'Copied ✓';
      setTimeout(() => { btn.textContent = `Wallet · ${btn.getAttribute('data-copy').slice(0, 4)}…${btn.getAttribute('data-copy').slice(-4)}`; }, 1500);
    } catch { /* clipboard unavailable: the address stays visible */ }
  }));
}

function parseHash() {
  const raw = location.hash || '#/';
  const [path, query] = raw.slice(1).split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') {
    return { kind: 'leaderboard', slug: decodeURIComponent(parts[1]), view: params.get('view') === 'overall' ? 'overall' : 'performance' };
  }
  if (parts[0] === 'bounty' && parts[1]) return { kind: 'bounty', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'u' && parts[1]) return { kind: 'profile', handle: decodeURIComponent(parts[1]) };
  return { kind: 'board' };
}

async function render() {
  window.__shotReady = false;
  route = parseHash();
  startTimers();
  try {
    if (route.kind === 'board') {
      document.title = 'make.fun — live bounty board';
      await renderBoard();
    } else if (route.kind === 'bounty') {
      await renderBounty(route.slug);
    } else if (route.kind === 'leaderboard') {
      await renderLeaderboard(route.slug, route.view);
    } else {
      await renderProfile(route.handle);
    }
  } catch (err) {
    document.title = 'make.fun — live bounty board';
    app.innerHTML = errorView(
      err?.status === 404
        ? 'Nothing lives at this address. It may have been removed, or the handle or bounty name is mistyped.'
        : 'make.fun did not answer. Your connection or the API may be down — the numbers you saw before are still the last good ones.',
    );
    wireRetry();
  }
  window.scrollTo(0, 0);
  setUpdated();
  window.__shotReady = true;
}

window.addEventListener('hashchange', render);
render();
