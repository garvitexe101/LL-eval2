/* Shared LostLink helpers: API client, session, UI helpers, footer, and branding. */
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* Configurable backend API URL for deployment (Requirement 5) */
const API_BASE_URL = (window.API_BASE_URL || '').replace(/\/$/, '');

/* Calls the Express API. Throws an Error with .status and .code on failure. */
async function api(path, { method = 'GET', body } = {}) {
  const url = `${API_BASE_URL}/api${path}`;
  const res = await fetch(url, {
    method,
    credentials: API_BASE_URL ? 'include' : 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Request failed. Please try again.');
    err.status = res.status;
    err.code = data && data.code;
    throw err;
  }
  return data;
}

let currentUser = null;
const user = () => currentUser;
/* Resolves once the session is known. Page scripts wait on this before rendering. */
const ready = api('/auth/me')
  .then(r => { currentUser = r.user; })
  .catch(() => { currentUser = null; })
  .then(() => updateProfile());

const icon = c => ({
  'Electronics': '◖◗', 'ID / Card': '▤', 'Bags': '▣', 'Keys': '⚿', 'Clothing': '◒', 'Books': '▧', 'Other': '◉'
})[c] || '◉';
const art = c => ({
  'Electronics': 'art-1', 'ID / Card': 'art-3', 'Bags': 'art-2', 'Keys': 'art-4', 'Other': 'art-2'
})[c] || 'art-4';
const fmtDate = d => new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function toast(m) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = m;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function updateProfile() {
  const u = currentUser, a = $('#profileInitial'), l = $('#profileLabel');
  if (a && l) {
    a.textContent = u ? u.name[0].toUpperCase() : '◉';
    l.textContent = u ? 'My profile' : 'Profile';
  }
  const b = $('#authButton');
  if (b && document.body.dataset.page !== 'admin') {
    const label = b.lastElementChild;
    if (label) label.textContent = u ? 'My profile' : 'Sign in';
  }
}

/* Only same-site relative pages are accepted as a post-login destination. */
function safeNext() {
  const n = new URLSearchParams(location.search).get('next');
  return n && /^[A-Za-z0-9_\-.]+(\?[A-Za-z0-9_\-.=&%]*)?$/.test(n) ? n : null;
}
function goSignIn() {
  const here = location.pathname.replace(/^\//, '') + location.search;
  location.href = 'signin.html' + (here && here !== 'signin.html' ? '?next=' + encodeURIComponent(here) : '');
}

function card(i) {
  return `<article class="item-card" data-item="${i.id}" tabindex="0"><div class="item-art ${art(i.category)}${i.hasImage ? ' has-img' : ''}">${i.hasImage ? `<img src="/api/items/${i.id}/image" alt="${esc(i.name)}" loading="lazy">` : icon(i.category)}</div><div class="item-body"><span class="status ${esc(i.type)}">${esc(i.type.toUpperCase())}</span><div class="item-title">${esc(i.name)}</div><div class="item-meta">⌖ ${esc(i.zone)}<br>◷ ${fmtDate(i.date)}</div><span class="claim-link">${i.type === 'found' ? 'View & claim item →' : 'View report →'}</span></div></article>`;
}
function bindCards() {
  $$('[data-item]').forEach(e => {
    e.onclick = () => location.href = `item.html?id=${e.dataset.item}`;
    e.onkeydown = x => x.key === 'Enter' && e.click();
  });
}

/* Administrator sign-in modal (checked by the server; the role is never decided in the browser). */
function openAdminLogin() {
  $('#appModal').innerHTML = `<div class="modal show"><div class="modal-card auth-card"><button class="close" id="closeLogin" type="button">×</button><p class="eyebrow"><span></span> LOSTLINK ADMIN</p><h2>Administrator access</h2><p>Sign in with an administrator account.</p><form id="workingLogin"><label>Email<input id="loginEmail" type="email" required placeholder="admin@chitkara.edu" autocomplete="username"><small></small></label><label>Password<input id="loginPassword" type="password" required placeholder="Enter your password" autocomplete="current-password"><small></small></label><button class="btn btn-dark">Admin sign in <b>→</b></button></form></div></div>`;
  $('#closeLogin').onclick = () => $('#appModal').innerHTML = '';
  $('#workingLogin').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await api('/auth/login', { method: 'POST', body: { email: $('#loginEmail').value, password: $('#loginPassword').value } });
      if (r.user.role !== 'admin') {
        await api('/auth/logout', { method: 'POST' });
        toast('That account is not an administrator.');
        return;
      }
      location.reload();
    } catch (err) {
      toast(err.message);
    }
  };
}

function footerUpgrade() {
  const f = $('footer');
  if (!f) return;
  f.classList.add('site-footer');
  f.innerHTML = `<div><a class="brand" href="index.html"><span class="brand-mark">L</span><span>Lost<span>Link</span></span></a><p>A trusted lost and found service for Chitkara University.</p></div><div><b>Explore</b><a href="browse.html">Browse reports</a><a href="map.html">Campus map</a><a href="how-it-works.html">How it works</a></div><div><b>Need help?</b><a href="how-it-works.html#contact">Contact support</a><a href="lost.html">Report lost item</a><a href="found.html">Report found item</a></div><small>© 2026 LostLink · Chitkara University</small>`;
}

function applyBrand() {
  document.title = document.title.replace(/LostLink/gi, 'LostLink');
  const ico = document.createElement('link');
  ico.rel = 'icon';
  ico.type = 'image/svg+xml';
  ico.href = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#17213a"/><path d="M19 20v25h21" fill="none" stroke="#fd805e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="43" cy="43" r="7" fill="#f9ca68"/></svg>');
  document.head.append(ico);

  $$('.brand').forEach(b => {
    const name = b.lastElementChild;
    if (name) name.innerHTML = 'Lost<span>Link</span>';
  });
  $$('.brand-mark').forEach(m => {
    m.innerHTML = '<i class="path-logo"><i class="person start"></i><i class="route"></i><i class="item-dot">◆</i><i class="person end"></i></i>';
    m.setAttribute('aria-label', 'LostLink people and item path logo');
  });

  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while (n = walk.nextNode()) {
    const tag = n.parentElement && n.parentElement.tagName;
    if (tag !== 'SCRIPT' && tag !== 'STYLE') n.nodeValue = n.nodeValue.replace(/LostLink/g, 'LostLink').replace(/LOSTLINK/g, 'LOSTLINK').replace(/lostlink/g, 'lostlink');
  }

  if (document.body.dataset.page === 'home') {
    const h = $('.hero h1'), p = $('.hero-text');
    if (h) h.innerHTML = 'Lost something?<br><em>Lost, found, back to you.</em>';
    if (p) p.textContent = 'LostLink makes it easy for the Chitkara community to report, match and safely return the things that matter.';
  }
}

footerUpgrade();
applyBrand();

const authBtn = $('#authButton');
if (authBtn && document.body.dataset.page !== 'admin') {
  authBtn.onclick = () => { location.href = currentUser ? 'profile.html' : 'signin.html'; };
}
