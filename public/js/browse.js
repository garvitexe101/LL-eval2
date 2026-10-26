/* Browse search, filters, counts, and report-card rendering (data from /api/items). */
(async function () {
  if (!$('#itemGrid')) return;

  let items = [], cat = 'all', type = 'all';

  function render() {
    const q = $('#searchInput').value.toLowerCase();
    const list = items.filter(i =>
      (cat === 'all' || i.category === cat) &&
      (type === 'all' || i.type === type) &&
      `${i.name} ${i.zone} ${i.colour} ${i.description}`.toLowerCase().includes(q));

    $('#itemGrid').innerHTML = list.map(card).join('');
    $('#emptyState').hidden = !!list.length;
    bindCards();
    $('#resultsHeading').textContent = `${cat === 'all' ? 'All' : cat} ${type === 'all' ? 'active reports' : type + ' reports'}`;

    const counts = {
      all: items.length,
      electronics: items.filter(i => i.category === 'Electronics').length,
      id: items.filter(i => i.category === 'ID / Card').length,
      bags: items.filter(i => i.category === 'Bags').length,
      keys: items.filter(i => i.category === 'Keys').length,
      other: items.filter(i => !['Electronics', 'ID / Card', 'Bags', 'Keys'].includes(i.category)).length
    };
    Object.entries(counts).forEach(([k, n]) => {
      const e = $('#count-' + k);
      if (e) e.textContent = n;
    });
  }

  $('#searchInput').oninput = render;
  $('#searchButton').onclick = render;
  $$('.category-tab').forEach(b => b.onclick = () => {
    cat = b.dataset.filter;
    $$('.category-tab').forEach(x => x.classList.toggle('active', x === b));
    render();
  });
  $$('.type-filter').forEach(b => b.onclick = () => {
    type = b.dataset.type;
    $$('.type-filter').forEach(x => x.classList.toggle('active', x === b));
    render();
  });

  try {
    items = (await api('/items')).items;
  } catch (e) {
    toast(e.message);
  }
  render();
})();
