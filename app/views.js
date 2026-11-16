// The four surfaces, each a function from API data to HTML:
// the board, one bounty, that bounty's leaderboard, one account's profile.
// Every value the API says is escaped before it reaches the page.

import { esc, md, money, num, dateUTC, timeLeft, pot, isOpen, ordinal, shortAddr } from './format.js';

/** An avatar URL the API names: make.fun-relative ones ride on make.fun. */
export function avatarUrl(u) {
  if (!u) return '';
  return u.startsWith('/') ? `https://make.fun${u}` : u;
}

/** An <img> for an avatar the API points at. make.fun's avatars send
    Cross-Origin-Resource-Policy: same-origin, so the anonymous CORS mode. */
function avatarImg(u, alt) {
  const src = avatarUrl(u);
  if (!src) return '';
  return `<img class="avatar" crossorigin="anonymous" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`;
}

/** Open-now or ended, by the deadline, not the status alone. */
function statusPill(b) {
  return isOpen(b) ? '<span class="pill open">Open</span>' : '<span class="pill ended">Ended</span>';
}

/** The entry fee where one is set, else a free-entry pill. */
function feePill(b) {
  return b.entryFeeUsd
    ? `<span class="pill fee">${money(b.entryFeeUsd)} fee</span>`
    : '<span class="pill free">Free entry</span>';
}

/* ---------------------------------------------------------------- board */

export function boardStats(items, stats) {
  const open = items.filter(isOpen);
  const potSum = items.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const entries = items.reduce((s, b) => s + Number(b.submissionCount ?? 0), 0);
  const siteEntries = stats?.entries?.total;
  return `<div class="stats">
    <div class="stat-card"><b>${open.length} / ${items.length}</b><span>open now</span></div>
    <div class="stat-card"><b>${money(potSum)}</b><span>live pots</span></div>
    <div class="stat-card"><b>${num(entries)}</b><span>entries here</span></div>
    <div class="stat-card"><b>${siteEntries ? num(siteEntries) : '—'}</b><span>entries site-wide</span></div>
  </div>`;
}

function boardCard(b) {
  const skills = (b.skills || []).slice(0, 3).map((s) => `<span class="chip">${esc(s)}</span>`).join('');
  const sponsor = b.sponsor?.isVerified ? `✓ ${esc(b.sponsor.name)}` : esc(b.sponsor?.name || '');
  return `<article class="card" data-slug="${esc(b.slug)}">
    <h3><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h3>
    <p class="sum">${esc(b.summary || b.description || '')}</p>
    <div class="nums">
      <span class="pot" data-pot="${esc(b.slug)}">${pot(b)} <small>pot</small></span>
      ${feePill(b)}
      <span data-left="${esc(b.slug)}">${timeLeft(b.deadline)}</span>
      <span data-entries="${esc(b.slug)}">${num(b.submissionCount)} entries</span>
    </div>
    <div>${skills}</div>
    <div class="foot">
      <span>${statusPill(b)} ${sponsor}</span>
      <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a>
    </div>
  </article>`;
}

export function boardCards(items) {
  if (!items.length) return '<p class="empty">No bounties match that. Try a different search or filter.</p>';
  return `<div class="grid">${items.map(boardCard).join('')}</div>`;
}

export function boardView(data, stats) {
  return `<h1>Open bounties</h1>
  <p class="muted">Every live bounty on make.fun, with its pot as it stands now. Pots grow as entry fees are paid in.</p>
  ${boardStats(data.items, stats)}
  <div class="toolbar">
    <input type="search" id="board-search" placeholder="Search bounties, skills, sponsors…" aria-label="Search bounties" autocomplete="off">
    <select id="board-sort" aria-label="Sort bounties">
      <option value="pot">Biggest pot</option>
      <option value="closing">Closing soonest</option>
      <option value="entries">Most entries</option>
      <option value="title">A–Z</option>
    </select>
    <span class="count" id="board-count"></span>
  </div>
  <div class="filters" id="board-filters" role="group" aria-label="Filter bounties">
    <button class="chip chip-btn on" data-filter="all">All</button>
    <button class="chip chip-btn" data-filter="open">Open now</button>
    <button class="chip chip-btn" data-filter="soon">Closing in 24h</button>
    <button class="chip chip-btn" data-filter="ended">Ended</button>
  </div>
  <div id="board-list">${boardCards(data.items)}</div>`;
}

/* --------------------------------------------------------------- bounty */

function rewardRows(b) {
  const rows = b.rewardsNow || [];
  if (!rows.length) return '<p class="muted">No reward table published yet.</p>';
  return `<div class="tbl-wrap"><table>
    <thead><tr><th>Place</th><th class="num">Base</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td>${ordinal(Number(r.place))}</td>
      <td class="num">${money(r.baseUsd)}</td>
      <td class="num">${money(r.feeShareUsd)}</td>
      <td class="num"><strong>${money(r.amountUsd)}</strong></td>
    </tr>`).join('')}</tbody>
  </table></div>
  <p class="small muted">Totals grow as entry fees are paid in; the fee share is split over the places in proportion to their rewards.</p>`;
}

function phaseList(b) {
  const phases = b.phases || [];
  if (!phases.length) return '';
  return `<h2>Dates</h2><ul class="entry-list">${phases.map((p) => `<li>
    <span class="t"><strong>${esc(p.title)}</strong><span class="sub">${esc(p.description || '')}</span></span>
    <span class="meta">${dateUTC(p.startsAt)} → ${dateUTC(p.endsAt)}</span>
  </li>`).join('')}</ul>`;
}

function topEntries(lb) {
  if (!lb?.entries?.length) return '';
  const rows = lb.entries.slice(0, 5).map((e) => `<li>
    <span class="t">${avatarImg(e.image, e.handle)}<a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a> — ${esc(e.title || 'Untitled entry')}</span>
    <span class="meta">${e.values?.judge != null ? `${(e.values.judge / 10000).toFixed(2)}% win rate` : ''}</span>
  </li>`).join('');
  return `<h2>Leading entries</h2><ul class="entry-list">${rows}</ul>
  <p><a href="#/bounty/${encodeURIComponent(lb.competition.slug)}/leaderboard">Full leaderboard →</a></p>`;
}

function recentEntries(b) {
  const subs = [...(b.submissions || [])].sort((a, c) => new Date(c.createdAt) - new Date(a.createdAt)).slice(0, 10);
  if (!subs.length) return '';
  return `<h2>Recent entries</h2><ul class="entry-list">${subs.map((s) => `<li>
    <span class="t"><a href="#/u/${encodeURIComponent(s.hunter)}">${esc(s.hunter)}</a> — ${esc(s.title || 'Untitled entry')}</span>
    <span class="meta">${s.status ? esc(s.status) : ''}${s.score != null ? ` · ${(s.score / 10000).toFixed(2)}%` : ''} · ${dateUTC(s.createdAt)}</span>
  </li>`).join('')}</ul>`;
}

function comments(b) {
  const chat = b.chat || [];
  if (!chat.length) return '';
  return `<h2>Discussion (${num(b.commentCount ?? chat.length)})</h2>${chat.slice(0, 5).map((c) => `<div class="comment">
    <div class="c-head"><a href="#/u/${encodeURIComponent(c.author)}">${esc(c.author)}</a> · ${dateUTC(c.createdAt)}</div>
    <div>${esc(c.body)}</div>
  </div>`).join('')}`;
}

/** The full rules, rendered only when the reader opens them (they are long). */
export function rulesHtml(b) {
  return b.rules ? md(b.rules) : '<p class="muted">No rules text published.</p>';
}

export function bountyView(b, lb) {
  const skills = (b.skills || []).map((s) => `<span class="chip">${esc(s)}</span>`).join('');
  return `<p class="crumbs"><a href="#/">Bounties</a> / ${esc(b.category || 'Bounty')}</p>
  <div class="hero">
    <h1>${esc(b.title)}</h1>
    <p class="lede">${esc(b.summary || '')}</p>
    <div>${statusPill(b)} ${feePill(b)} ${skills}</div>
    <div class="hero-stats">
      <div class="stat-card"><b class="pot-b" data-pot="${esc(b.slug)}">${pot(b)}</b><span>live pot</span></div>
      <div class="stat-card"><b>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</b><span>entry fee</span></div>
      <div class="stat-card"><b data-entries="${esc(b.slug)}">${num(b.submissionCount)}</b><span>entries</span></div>
      <div class="stat-card"><b data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</b><span>time left</span></div>
    </div>
    <div class="hero-actions">
      <a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a>
      <a class="btn ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">Open on make.fun ↗</a>
    </div>
    <p class="small muted">Deadline ${dateUTC(b.deadline)} · Sponsor ${b.sponsor?.isVerified ? '✓ ' : ''}${esc(b.sponsor?.name || '')} · ${num(b.entryFeePayers ?? 0)} paid the entry fee</p>
  </div>
  <div class="cols">
    <section>
      <h2>About this bounty</h2>
      ${b.description ? md(b.description) : '<p class="muted">No description published.</p>'}
      <details class="rules" id="rules-box">
        <summary>Rules</summary>
        <div id="rules-body"><p class="muted">Opening…</p></div>
      </details>
    </section>
    <aside>
      <h2>Rewards</h2>
      ${rewardRows(b)}
      ${phaseList(b)}
    </aside>
  </div>
  ${topEntries(lb)}
  ${recentEntries(b)}
  ${comments(b)}`;
}

/* ---------------------------------------------------------- leaderboard */

function rate(v) {
  return v == null ? '—' : `${(v / 10000).toFixed(2)}%`;
}

export function leaderboardView(lb, slug, view, bounty) {
  const entries = lb.entries || [];
  const prizes = {};
  for (const r of bounty?.rewardsNow || []) prizes[Number(r.place)] = r.amountUsd;
  const rows = entries.map((e) => {
    const prize = e.prize_rank && prizes[e.prize_rank] ? money(prizes[e.prize_rank]) : '';
    const cls = [e.rank <= 3 ? 'top3' : '', e.prize_rank && e.prize_rank <= 20 ? 'paid' : ''].join(' ').trim();
    return `<tr class="${cls}">
      <td>${e.rank}</td>
      <td class="entrant"><span class="who">${avatarImg(e.image, e.handle)}<a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a></span>
        <span class="sub">${esc(e.title || 'Untitled entry')}</span></td>
      <td class="num"><span class="rate-bar" aria-hidden="true"><i style="width:${Math.min(100, (e.values?.judge ?? 0) / 10000)}%"></i></span>${rate(e.values?.judge)}<span class="sub">${rate(e.values?.judge_low)} – ${rate(e.values?.judge_high)}</span></td>
      <td class="num">${e.values?.valid ? '✓' : '—'}</td>
      <td class="num">${e.values?.bytes != null ? `${(e.values.bytes / 1024).toFixed(1)} KB` : '—'}</td>
      <td class="num">${prize ? `<strong>${prize}</strong>` : '—'}</td>
    </tr>`;
  }).join('');
  return `<p class="crumbs"><a href="#/">Bounties</a> / <a href="#/bounty/${encodeURIComponent(slug)}">${esc(lb.competition?.title || slug)}</a> / Leaderboard</p>
  <h1>Leaderboard</h1>
  <p class="muted">${esc(lb.title || 'Results')} · ${esc(lb.phase?.title || '')} phase${lb.phase?.scores_visible === false ? ' · scores hidden until the final' : ''} · ${num(entries.length)} ranked entries${lb.metrics_withheld ? ' · some scores withheld' : ''}</p>
  <div class="toolbar">
    <input type="search" id="lb-filter" placeholder="Filter by handle or entry title…" aria-label="Filter leaderboard" autocomplete="off">
    <span class="seg" role="group" aria-label="Leaderboard view">
      <button type="button" data-view="performance" aria-pressed="${view === 'performance'}">Performance</button>
      <button type="button" data-view="overall" aria-pressed="${view === 'overall'}">Overall</button>
    </span>
    <span class="count">${num(entries.length)} entries</span>
  </div>
  ${entries.length ? `<div class="tbl-wrap"><table>
    <thead><tr><th>#</th><th>Entrant</th><th class="num">Win rate · 90% interval</th><th class="num">Valid</th><th class="num">Size</th><th class="num">Prize now</th></tr></thead>
    <tbody id="lb-body">${rows}</tbody>
  </table></div>
  <p class="small muted">Win rate is the AI judge's pairwise win rate, with its 90% interval beneath it. Places 1–20 share the $500 reward plus the entry fees paid in; the prize column shows each place's share of the live pot. Ties break on entry size, smaller first.</p>`
  : '<p class="empty">No ranked entries yet — check back once the judging starts.</p>'}`;
}

/* -------------------------------------------------------------- profile */

export function profileView(p) {
  const r = p.record || {};
  const initial = (p.display_name || p.handle || '?').trim().charAt(0).toUpperCase();
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}" target="_blank" rel="noopener">GitHub · ${esc(p.github_login)}</a>`);
  if (p.x) links.push(`<a href="https://x.com/${encodeURIComponent(p.x)}" target="_blank" rel="noopener">X · @${esc(p.x)}</a>`);
  if (p.discord) links.push(`<span class="pill">Discord · ${esc(p.discord)}</span>`);
  if (p.wallet) {
    const addr = typeof p.wallet === 'string' ? p.wallet : p.wallet.address;
    const explorer = typeof p.wallet === 'object' && p.wallet.explorer_url ? p.wallet.explorer_url : '';
    links.push(explorer
      ? `<a href="${esc(explorer)}" target="_blank" rel="noopener">Wallet · ${shortAddr(addr)}</a>`
      : `<button type="button" data-copy="${esc(addr)}" title="Copy wallet address">Wallet · ${shortAddr(addr)}</button>`);
  }
  const solutions = p.solutions || [];
  const payouts = p.payouts || [];
  return `<div class="profile-head">
    ${p.image ? `<img class="big-avatar" crossorigin="anonymous" src="${esc(avatarUrl(p.image))}" alt="${esc(p.display_name || p.handle)}">` : `<span class="initials" aria-hidden="true">${esc(initial)}</span>`}
    <div>
      <h1>${esc(p.display_name || p.handle)}</h1>
      <div class="handle">@${esc(p.handle)} · joined ${dateUTC(p.joined_at)}</div>
      ${p.bio ? `<p class="muted" style="margin:8px 0 0">${esc(p.bio)}</p>` : ''}
    </div>
  </div>
  ${links.length ? `<div class="links-row">${links.join('')}</div>` : ''}
  <div class="stats">
    <div class="stat-card"><b>${num(r.competitions_entered)}</b><span>entered</span></div>
    <div class="stat-card"><b>${num(r.competitions_placed)}</b><span>placed</span></div>
    <div class="stat-card"><b>${num(r.competitions_won)}</b><span>won</span></div>
    <div class="stat-card"><b>${money(r.prize_usd)}</b><span>prize money</span></div>
  </div>
  <h2>Entries (${num(solutions.length)})</h2>
  ${solutions.length ? `<div class="tbl-wrap"><table>
    <thead><tr><th>Entry</th><th>Competition</th><th class="num">Win rate</th><th class="num">Place</th><th class="num">Prize</th></tr></thead>
    <tbody>${solutions.map((s) => `<tr>
      <td>${esc(s.title || 'Untitled entry')}<span class="sub">${dateUTC(s.entered_at)}</span></td>
      <td><a href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.competition.title)}</a></td>
      <td class="num">${s.score?.value != null ? rate(s.score.value) : '—'}</td>
      <td class="num">${s.placement ? ordinal(Number(s.placement)) : '—'}</td>
      <td class="num">${s.prize_usd ? money(s.prize_usd) : '—'}</td>
    </tr>`).join('')}</tbody>
  </table></div>` : '<p class="muted">No entries yet.</p>'}
  <h2>Payouts (${num(payouts.length)})</h2>
  ${payouts.length ? `<ul class="entry-list">${payouts.map((x) => `<li>
    <span class="t"><strong>${money(x.amount_usd)}</strong> · ${ordinal(Number(x.place))} place · <a href="#/bounty/${encodeURIComponent(x.competition.slug)}">${esc(x.competition.title)}</a></span>
    <span class="meta">${dateUTC(x.paid_at)} · <a href="${esc(x.explorer_url)}" target="_blank" rel="noopener">Solana ↗</a></span>
  </li>`).join('')}</ul>` : '<p class="muted">No prizes paid yet.</p>'}`;
}
