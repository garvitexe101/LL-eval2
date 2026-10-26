/* Lost / found report form: zone list from the API, photo preview, validation, and submission. */
(async function () {
  const f = $('#reportForm');
  if (!f) return;

  const MAX_IMAGE = 2 * 1024 * 1024;
  let image = '';

  $('#privateDetail').closest('label').insertAdjacentHTML('afterend', '<label class="image-upload">Attach a photo <span>Optional · PNG, JPEG, GIF or WebP up to 2 MB</span><input id="itemImage" type="file" accept="image/png,image/jpeg,image/gif,image/webp"><img id="imagePreview" hidden alt="Item preview"></label><aside class="form-safety">⚠ For your safety, never arrange a handover in an isolated place. Use Security Office or Student Centre.</aside>');

  $$('select').forEach(s => s.classList.add('modern-select'));
  $('#date').value = new Date().toISOString().slice(0, 10);

  try {
    const meta = await api('/meta');
    $('#zone').innerHTML = '<option value="">Choose campus location</option>' + meta.zones.map(z => `<option>${esc(z.name)}</option>`).join('');
  } catch (e) {
    toast('Could not load campus locations. Is the server running?');
  }

  $('#itemImage').onchange = e => {
    const file = e.target.files[0];
    image = '';
    $('#imagePreview').hidden = true;
    if (!file) return;
    if (file.size > MAX_IMAGE) {
      toast('Photo must be 2 MB or smaller.');
      e.target.value = '';
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      image = r.result;
      const img = $('#imagePreview');
      img.src = image;
      img.hidden = false;
    };
    r.readAsDataURL(file);
  };

  f.onsubmit = async e => {
    e.preventDefault();
    await ready;
    if (!user()) {
      toast('Please sign in first so your report can appear in My reports.');
      setTimeout(goSignIn, 700);
      return;
    }
    if (!f.checkValidity()) {
      f.reportValidity();
      return;
    }

    const btn = f.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const r = await api('/items', {
        method: 'POST',
        body: {
          type: $('#reportType').value,
          name: $('#itemName').value,
          category: $('#category').value,
          colour: $('#colour').value.trim(),
          zone: $('#zone').value,
          date: $('#date').value,
          time: $('#time') ? $('#time').value : '',
          description: $('#description').value,
          privateDetail: $('#privateDetail').value,
          deposit: $('#deposit') ? $('#deposit').value : '',
          image
        }
      });
      const n = r.matches.length;
      toast(n ? `Report posted — ${n} possible match${n > 1 ? 'es' : ''} found. Check your profile.` : 'Report posted successfully.');
      setTimeout(() => location.href = 'profile.html', 1200);
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  };
})();
