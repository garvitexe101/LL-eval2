/* Profile page: account, notifications, possible matches, and my reports (all from the API). */
function noticeHtml(n) {
  if (n.type === 'claim-approved') {
    return `<div class="claim-approved-notice"><div class="notice-icon">✓</div><div class="notice-content"><span class="notice-label">CLAIM UPDATE</span><h3>${esc(n.title)}</h3><p>${esc(n.message)}</p><div class="collection-location"><span>COLLECTION LOCATION</span><b>Security Office behind Turing Block</b></div><div class="collection-note"><b>Important reminder</b><span>${esc(n.note || 'Please carry your valid Student ID while visiting the Security Office to collect the item.')}</span></div></div></div>`;
  }
  if (n.type === 'claim-rejected') {
    return `<div class="claim-rejected-notice"><div class="notice-icon rejected-icon">×</div><div class="notice-content"><span class="notice-label">CLAIM UPDATE</span><h3>${esc(n.title)}</h3><p>${esc(n.message)}</p><div class="collection-note"><b>Note</b><span>${esc(n.note || 'If you believe this decision was incorrect, please contact the campus lost-and-found team.')}</span></div></div></div>`;
  }
  return `<div class="claim-approved-notice"><div class="notice-icon">${n.type === 'match' ? '⌖' : '✓'}</div><div class="notice-content"><span class="notice-label">${n.type === 'match' ? 'MATCH UPDATE' : 'UPDATE'}</span><h3>${esc(n.title)}</h3><p>${esc(n.message)}</p></div></div>`;
}

async function renderProfile() {
  if (document.body.dataset.page !== 'profile') return;
  await ready;
  const u = user();
  const page = $('#profilePage');

  if (!u) {
    page.innerHTML = `<section class="profile-card"><p class="eyebrow"><span></span> YOUR LOSTLINK PROFILE</p><span class="large-avatar">◉</span><h1>Welcome to<br>LostLink.</h1><p>Sign in to create reports, see match updates and follow your claims.</p><div class="profile-actions"><button type="button" class="btn btn-dark" id="quickSignIn">Sign in <b>→</b></button><a class="btn btn-light" href="admin.html">Admin sign in</a></div></section>`;
    $('#quickSignIn').onclick = () => { location.href = 'signin.html'; };
    return;
  }

  let mine = [], notices = [], matches = [];
  try {
    [mine, notices, matches] = await Promise.all([
      api('/items/mine').then(r => r.items),
      api('/notifications').then(r => r.notifications),
      api('/matches/mine').then(r => r.matches)
    ]);
  } catch (e) {
    toast(e.message);
  }

  page.innerHTML = `<section class="profile-card profile-top"><p class="eyebrow"><span></span> ${u.role === 'admin' ? 'ADMINISTRATOR' : 'STUDENT'} ACCOUNT</p><span class="large-avatar">${esc(u.name ? u.name[0].toUpperCase() : 'U')}</span><h1>${esc(u.name || 'LostLink User')}</h1><p>${esc(u.email || '')}</p><div class="profile-actions">${u.role === 'admin' ? '<a class="btn btn-dark" href="admin.html">Admin dashboard <b>→</b></a>' : '<a class="btn btn-dark" href="lost.html">Report an item <b>→</b></a>'}<button type="button" class="btn btn-light" id="signOut">Sign out</button></div></section>
    <section class="notification-centre"><p class="eyebrow"><span></span> NOTIFICATION CENTRE</p><h2>Recent updates</h2><div id="profileNoticeList">${notices.map(noticeHtml).join('')}</div>${notices.length ? '' : '<p class="alert-row" id="emptyNotificationMessage">✓ You’re all caught up. New matches and claim updates will appear here.</p>'}</section>
    <section class="my-reports"><div><p class="eyebrow"><span></span> POSSIBLE MATCHES</p><h2>Reports that may be connected</h2></div><div class="my-report-grid">${matches.length ? matches.map(m => `<a class="alert-row" href="item.html?id=${m.other.id}" style="display:block"><b>${m.score}% match</b> · your ${esc(m.mine.type)} “${esc(m.mine.name)}” ↔ ${esc(m.other.type)} “${esc(m.other.name)}” at ${esc(m.other.zone)}<br><small>${esc(m.reasons.join(' · '))}</small></a>`).join('') : '<p class="empty-map-state">No possible matches yet.</p>'}</div></section>
    <section class="my-reports"><div><p class="eyebrow"><span></span> MY REPORTS</p><h2>Your lost & found activity</h2></div><div class="my-report-grid">${mine.length ? mine.map(card).join('') : '<p class="empty-map-state">You have not posted a report yet.</p>'}</div></section>`;

  bindCards();
  $('#signOut').onclick = async () => {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        await firebase.auth().signOut().catch(() => {});
      }
      await api('/auth/logout', { method: 'POST' });
    } catch (e) { /* already signed out */ }
    location.href = 'profile.html';
  };

  if (notices.some(n => !n.read)) api('/notifications/read-all', { method: 'POST' }).catch(() => {});
}

renderProfile();
