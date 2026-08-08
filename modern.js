(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = [...document.querySelectorAll('main section, .signal-band')];
  sections.forEach((section) => section.setAttribute('data-reveal', ''));
  if (reducedMotion || !('IntersectionObserver' in window)) sections.forEach((section) => section.classList.add('is-visible'));
  else {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    sections.forEach((section) => observer.observe(section));
  }
  const consolePanel = document.querySelector('.decision-console');
  if (!consolePanel) return;
  const readout = document.createElement('div');
  readout.className = 'field-readout';
  readout.innerHTML = '<i aria-hidden="true"></i><span>Modo de lectura</span><b>Diagnostico inicial</b>';
  consolePanel.prepend(readout);
  const labels = {
    'encargo-informe':'Informe tecnico',
    'encargo-expediente':'Proyecto y expediente',
    licitaciones:'Licitacion publica'
  };
  consolePanel.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const key = Object.keys(labels).find((name) => href.includes(name));
    if (!key) return;
    const update = () => { readout.querySelector('b').textContent = labels[key]; };
    link.addEventListener('pointerenter', update); link.addEventListener('focus', update);
  });
})();
