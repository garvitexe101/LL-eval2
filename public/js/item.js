/* Item detail page: public report details, ownership claim form, and matches for the owner. */
(async function () {
  if (document.body.dataset.page !== 'item') return;

  const page = $('#itemPage');
  const id = new URLSearchParams(location.search).get('id');
  await ready;

  let item;
  try {
    item = (await api('/items/' + encodeURIComponent(id))).item;
  } catch (e) {
    page.innerHTML = '<div class="not-found">Item not found.</div>';
    return;
  }

  const myClaim = item.myClaim && item.myClaim.status;
  const canClaim = item.type === 'found' && item.status !== 'Returned' && !item.mine;

  let claimBox = '';
  if (canClaim) {
    claimBox = `<section class="claim-box"><p class="eyebrow"><span></span> OWNERSHIP VALIDATION</p><h2>Think it may be yours?</h2><p>Submit your answers below. Your claim will be reviewed manually by a campus administrator.</p>${
      myClaim === 'pending'
        ? '<p class="alert-row">Your claim has been submitted and is waiting for admin review.</p>'
        : `${myClaim === 'rejected' ? '<p class="alert-row">Your earlier claim was not approved. You can submit a new one with more accurate details.</p>' : ''}<form id="claimForm"><label>What colour is it?<input type="text" id="claimColour" maxlength="200" placeholder="Enter the colour" required></label><label>Where was it found?<input type="text" id="claimLocation" maxlength="200" placeholder="Enter the location" required></label><label>Name one private feature<input type="text" id="claimPrivate" maxlength="200" placeholder="Enter a private identifying feature" required></label><label>What public-description word matches?<input type="text" id="claimDescription" maxlength="200" placeholder="Enter a matching description word" required></label><button type="submit" class="btn btn-dark">Submit verification <b>→</b></button></form>`
    }</section>`;
  } else if (item.mine) {
    claimBox = `<section class="claim-box"><p class="eyebrow"><span></span> YOUR REPORT</p><h2>This is your report</h2><p>Private detail on file: <b>${esc(item.privateDetail || 'None')}</b></p><div id="ownerMatches"></div></section>`;
  }

  page.innerHTML = `<section class="item-detail"><div class="detail-art">${item.hasImage ? `<img src="/api/items/${item.id}/image" alt="${esc(item.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : icon(item.category)}</div><div class="detail-main"><p class="eyebrow"><span></span> ${esc(item.type.toUpperCase())} REPORT</p><h1>${esc(item.name)}</h1><p class="detail-description">${esc(item.description || 'No description provided.')}</p><div class="detail-grid"><div><small>CATEGORY</small><b>${esc(item.category)}</b></div><div><small>COLOUR</small><b>${esc(item.colour)}</b></div><div><small>STATUS</small><b>${esc(item.status)}</b></div><div><small>CAMPUS ZONE</small><b>${esc(item.zone)}</b></div><div><small>DATE</small><b>${esc(item.date)}</b></div><div><small>${item.type === 'found' ? 'CURRENTLY' : 'TYPE'}</small><b>${esc(item.type === 'found' && item.deposit ? item.deposit : item.type.toUpperCase())}</b></div></div></div></section>${claimBox}`;

  if (item.mine) loadOwnerMatches();

  const form = $('#claimForm');
  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      if (!user()) {
        toast('Please sign in before submitting a claim.');
        setTimeout(goSignIn, 700);
        return;
      }
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        await api(`/items/${item.id}/claims`, {
          method: 'POST',
          body: {
            colour: $('#claimColour').value,
            location: $('#claimLocation').value,
            privateFeature: $('#claimPrivate').value,
            descriptionWord: $('#claimDescription').value
          }
        });
        toast('Claim submitted successfully. An admin will review it.');
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        toast(err.message);
        btn.disabled = false;
      }
    };
  }

  async function loadOwnerMatches() {
    const box = $('#ownerMatches');
    try {
      const { matches } = await api(`/items/${item.id}/matches`);
      box.innerHTML = matches.length
        ? '<h3>Possible matches</h3>' + matches.map(m => `<a class="alert-row" href="item.html?id=${m.item.id}" style="display:block;margin-top:8px"><b>${m.score}% match</b> · ${esc(m.item.name)} (${esc(m.item.zone)}) — ${esc(m.reasons.join(', '))}</a>`).join('')
        : '<p>No matches yet. We will notify you if a similar report appears.</p>';
    } catch (e) {
      box.innerHTML = '';
    }
  }
})();
