/* Home page enhancements and safety content. */
(async function () {
  if (document.body.dataset.page !== 'home') return;

  const hero = $('.hero');
  hero && hero.insertAdjacentHTML('afterend', '<aside class="safety-banner"><span>⚠</span><p><b>Campus safety reminder</b> Arrange handovers only in busy, well-lit places such as the Security Office or Student Centre.</p><a href="how-it-works.html#contact">Get support →</a></aside>');
  const target = $('.map-promo');
  target && target.insertAdjacentHTML('beforebegin', '<section class="returned-section"><div><p class="eyebrow"><span></span> SUCCESS STORIES</p><h2>Recently returned</h2><p>Honesty makes a difference on campus.</p></div><div id="returnedItems" class="returned-list"></div></section>');

  const s = $('.safety-banner'), f = $('footer');
  if (s && f) f.before(s);

  const box = $('#returnedItems');
  if (!box) return;
  try {
    const r = (await api('/items/returned')).items;
    box.innerHTML = r.length
      ? r.map(i => `<a href="item.html?id=${i.id}"><span>${icon(i.category)}</span><b>${esc(i.name)}</b><small>Returned safely ✓</small></a>`).join('')
      : '<p>No returned items yet.</p>';
  } catch (e) {
    box.innerHTML = '<p>No returned items yet.</p>';
  }
})();
