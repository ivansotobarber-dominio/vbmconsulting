(() => {
  const aliases = { servicios: 'soluciones' };
  const sections = new Set(['contenido','menu-principal','soluciones','experiencia','experience-title','control-obra','control-title','coast-title','encargo-informe','encargo-expediente','licitaciones','metodo','sectores','productos-digitales','digital-products-title','ecosystem-title','faq-title','contacto']);
  let fragment;
  try { fragment = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = aliases[fragment] || fragment;
  if (sections.has(target)) location.replace(new URL('web.html#' + encodeURIComponent(target), location.href).href);
})();
