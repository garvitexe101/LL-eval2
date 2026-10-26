/* Admin dashboard. Every action is re-checked by the server; this page only renders the results. */
async function renderAdmin() {
  if (document.body.dataset.page !== 'admin') return;
  await ready;

  const gateLogin = () => openAdminLogin();
  const loginBtn = $('#adminLogin'), topBtn = $('#authButton');
  if (loginBtn) loginBtn.onclick = gateLogin;

  const u = user();
  if (!u || u.role !== 'admin') {
    if (topBtn) topBtn.onclick = gateLogin;
    if (u) toast('Signed in as a student. Use an administrator account to continue.');
    return;
  }

  if (topBtn) {
    topBtn.lastElementChild.textContent = 'Sign out';
    topBtn.onclick = async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => {});
      location.reload();
    };
  }

  let overview, claims, items;
  try {
    [overview, claims, items] = await Promise.all([
      api('/admin/overview'),
      api('/admin/claims?status=pending').then(r => r.claims),
      api('/admin/items').then(r => r.items)
    ]);
  } catch (e) {
    toast(e.message);
    return;
  }

  const row = (label, value) => `<p><span>${label}</span><b>${esc(value || 'Not provided')}</b></p>`;

  $('#adminApp').innerHTML = `<div class="admin-dashboard">
    <div class="admin-head"><div><p class="eyebrow"><span></span> LOSTLINK ADMIN</p><h1>Hello, ${esc(u.name)}.</h1><p>Moderate reports and decide verified ownership claims.</p></div></div>
    <div class="admin-stats">
      <div class="stat"><span>Active reports</span><b>${overview.activeReports}</b></div>
      <div class="stat"><span>Returned items</span><b>${overview.returnedItems}</b></div>
      <div class="stat"><span>Possible matches</span><b>${overview.possibleMatches}</b></div>
      <div class="stat"><span>Claims to review</span><b>${overview.pendingClaims}</b></div>
    </div>
    <section class="moderation"><h2>Claim review</h2>${claims.length ? claims.map(c => `
      <div class="claim-review"><div class="claim-review-main">
        <div class="claim-review-title"><span class="moderation-icon">${icon(c.item.category)}</span><div><b>${esc(c.item.name)}</b><small>${esc(c.item.type.toUpperCase())} · ${esc(c.item.status)}</small></div></div>
        <div class="admin-claim-grid">
          <div class="admin-claim-section"><h4>Claimant details</h4>${row('Name', c.claimant.name)}${row('Email', c.claimant.email)}${row('Submitted', new Date(c.createdAt).toLocaleString())}</div>
          <div class="admin-claim-section"><h4>Claimant answers</h4>${row('Colour', c.answers.colour)}${row('Where was it found?', c.answers.location)}${row('Private feature', c.answers.privateFeature)}${row('Description word', c.answers.descriptionWord)}</div>
          <div class="admin-claim-section finder-private"><h4>Finder's original details</h4>${row('Finder', c.item.finder.email)}${row('Original colour', c.item.colour)}${row('Reported location', c.item.zone)}${row('Private detail', c.item.privateDetail)}${row('Description', c.item.description)}</div>
        </div></div>
        <div class="claim-actions"><button class="approve-claim" data-approve="${c.id}">Approve & return</button><button class="reject-claim" data-reject="${c.id}">Reject</button></div>
      </div>`).join('') : '<p class="empty-map-state">No claims are waiting for review.</p>'}</section>
    <section class="moderation"><h2>Report visibility</h2>${items.map(i => `
      <div class="moderation-row"><span class="moderation-icon">${icon(i.category)}</span><div class="moderation-info"><b>${esc(i.name)}</b><small>${esc(i.type.toUpperCase())} · ${esc(i.status)} · ${esc(i.ownerEmail)}</small></div><button class="visibility" data-delete="${i.id}">Remove item</button></div>`).join('')}</section>
  </div>`;

  async function decide(id, decision) {
    try {
      await api(`/admin/claims/${id}/decision`, { method: 'POST', body: { decision } });
      toast(decision === 'approve' ? 'Claim approved. The claimant has been emailed collection instructions.' : 'Claim rejected. The claimant has been notified.');
      renderAdmin();
    } catch (err) {
      toast(err.message);
    }
  }
  $$('[data-approve]').forEach(b => b.onclick = () => decide(b.dataset.approve, 'approve'));
  $$('[data-reject]').forEach(b => b.onclick = () => decide(b.dataset.reject, 'reject'));
  $$('[data-delete]').forEach(b => b.onclick = async () => {
    if (!confirm('Remove this report permanently?')) return;
    try {
      await api(`/admin/items/${b.dataset.delete}`, { method: 'DELETE' });
      toast('Report removed.');
      renderAdmin();
    } catch (err) {
      toast(err.message);
    }
  });
}

renderAdmin();
