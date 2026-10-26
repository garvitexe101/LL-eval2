/* How-it-works page navigation. */
const contactLink = document.querySelector('a[href="#contact"]');
if (contactLink) contactLink.addEventListener('click', () => document.querySelector('#contact')?.focus( {
  preventScroll:true
}));
