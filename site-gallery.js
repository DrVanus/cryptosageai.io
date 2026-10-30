// Screenshot selection is deliberate: no automatic movement or layered crossfades.
(() => {
  const controls = document.querySelector('.hero-view-controls');
  const slides = [...document.querySelectorAll('.hero-slide')];
  if (controls && slides.length) {
    controls.hidden = false;
    const select = index => {
      slides.forEach((slide, i) => {
        slide.hidden = i !== index;
        slide.setAttribute('aria-hidden', String(i !== index));
      });
      controls.querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    };
    controls.addEventListener('click', event => {
      const button = event.target.closest('button[data-slide]');
      if (button) select(Number(button.dataset.slide));
    });
    select(0);
  }
  // Native dialog supplies modal focus, Escape dismissal, and background isolation.
  const images = [...document.querySelectorAll('.phone-card .phone-front')];
  if (!images.length || typeof HTMLDialogElement === 'undefined') return;
  const dialog = document.createElement('dialog');
  dialog.className = 'screen-dialog';
  dialog.setAttribute('aria-labelledby', 'screen-dialog-title');
  dialog.innerHTML = '<header><h2 id="screen-dialog-title">A closer look</h2><button type="button" aria-label="Close screenshot">×</button></header><img alt=""><p></p>';
  document.body.append(dialog);
  let trigger = null;
  const close = () => dialog.close();
  dialog.querySelector('button').addEventListener('click', close);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('close', () => { if (trigger) trigger.focus({preventScroll:true}); });
  const open = img => {
    trigger = img;
    const preview = dialog.querySelector('img');
    preview.src = img.currentSrc || img.src;
    preview.alt = img.alt;
    dialog.querySelector('p').textContent = img.alt;
    dialog.showModal();
  };
  images.forEach(img => {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'Enlarge screenshot: ' + img.alt);
    img.setAttribute('aria-haspopup', 'dialog');
    img.addEventListener('click', () => open(img));
    img.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(img); }
    });
  });
})();
