// Small helpers for showing API values. Everything the API says is text
// before it reaches the page: esc() keeps it that way.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('654.50', 1325 or '0.50') as '$654.50' or '$1,325'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** A count as '13,423'. */
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

/** A deadline as a date in UTC. */
export function dateUTC(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** Milliseconds until a deadline, split into days, hours, minutes, seconds. */
export function leftParts(iso) {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  return {
    ms,
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

/** The time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const p = leftParts(iso);
  if (p.ms <= 0) return 'ended';
  if (p.days > 0) return `${p.days}d ${p.hours}h left`;
  if (p.hours > 0) return `${p.hours}h ${p.minutes}m left`;
  if (p.minutes > 0) return `${p.minutes}m left`;
  return `${p.seconds}s left`;
}

/** The same, ticking: '2d 4h 12m 09s left'. Updated in place every second. */
export function timeLeftTicking(iso) {
  const p = leftParts(iso);
  if (p.ms <= 0) return 'ended';
  const pad = (n) => String(n).padStart(2, '0');
  if (p.days > 0) return `${p.days}d ${p.hours}h ${pad(p.minutes)}m ${pad(p.seconds)}s left`;
  if (p.hours > 0) return `${p.hours}h ${pad(p.minutes)}m ${pad(p.seconds)}s left`;
  return `${p.minutes}m ${pad(p.seconds)}s left`;
}

/** A bounty still takes entries while its deadline is ahead, whatever its status says. */
export function isOpen(b) {
  return b && b.deadline ? new Date(b.deadline).getTime() > Date.now() : b?.status === 'open';
}

/** The reward as it stands now: the prize plus any entry fees paid into it. */
export function pot(b) {
  return money(b.potUsd ?? b.rewardAmount);
}

/** '1st', '2nd', '3rd', '4th' … */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** A short address: '6Ftn…SXC5'. */
export function shortAddr(addr) {
  const s = String(addr ?? '');
  return s.length > 10 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

/** A tiny markdown reader for the API's descriptions and rules: headings,
    bold, italic, inline code, links and bullet lists. HTML is escaped first. */
export function md(src) {
  const lines = String(src ?? '').split('\n');
  let html = '';
  let inList = false;
  let inPara = false;
  const close = () => {
    if (inList) { html += '</ul>'; inList = false; }
    if (inPara) { html += '</p>'; inPara = false; }
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { close(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      close();
      const level = Math.min(6, h[1].length + 1);
      html += `<h${level} class="md-h">${inline(h[2])}</h${level}>`;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (inPara) { html += '</p>'; inPara = false; }
      if (!inList) { html += '<ul class="md-ul">'; inList = true; }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`;
      continue;
    }
    if (!inPara) { html += '<p class="md-p">'; inPara = true; }
    else html += ' ';
    html += inline(line);
  }
  close();
  return html;
}

/** Inline markdown inside an already-escaped line. */
function inline(s) {
  return esc(s)
    .replace(/`([^`\n]+)`/g, (m, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (m, c) => `<strong>${c}</strong>`)
    .replace(/(^|[^\w*])\*([^*\n]+)\*/g, (m, p, c) => `${p}<em>${c}</em>`)
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
}
