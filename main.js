const sectors = {
  administracion: { eyebrow: "Administración y empresas públicas", title: "Priorizar inversiones y llevar la ejecución con un expediente claro.", copy: "Inventarios, informes, proyectos, asistencia técnica, seguimiento de contratos y modelos de decisión para infraestructuras y activos que deben dar servicio durante años.", link: "Plantear necesidad pública" },
  promotores: { eyebrow: "Promotores y propietarios de activos", title: "Antes de invertir, hacer visible el riesgo técnico y económico.", copy: "Diagnósticos, alternativas, expedientes, revisión de documentación y seguimiento para activos, terrenos, obras y decisiones de conservación.", link: "Plantear un activo" },
  empresas: { eyebrow: "Empresas, industria y hoteles", title: "Instalaciones y recursos con un plan de mejora que se pueda ejecutar.", copy: "Análisis de infraestructuras, agua, energía y mantenimiento; la solución se estructura para decidir, contratar y medir después.", link: "Plantear una mejora" },
  equipos: { eyebrow: "Ingenierías y equipos de proyecto", title: "Capacidad técnica adicional cuando el encargo exige más profundidad.", copy: "Apoyo en informes, mediciones, control documental, coordinación y elaboración de entregables para reforzar un equipo sin perder trazabilidad.", link: "Reforzar un equipo" }
};
const sectorPanel = document.querySelector('[data-sector-panel]');
document.querySelectorAll('[data-sector]').forEach((button) => {
  button.addEventListener('click', () => {
    const sector = sectors[button.dataset.sector];
    if (!sector || !sectorPanel) return;
    document.querySelectorAll('[data-sector]').forEach((item) => item.classList.toggle('is-active', item === button));
    sectorPanel.innerHTML = `<p class="eyebrow">${sector.eyebrow}</p><h3>${sector.title}</h3><p>${sector.copy}</p><a href="#contacto">${sector.link}</a>`;
  });
});
const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');
if (menuButton && menu) {
  menuButton.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
}
const form = document.querySelector('[data-contact-form]');
if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const subject = `Consulta web VB&M: ${data.get('nombre')}`;
    const body = `Nombre o entidad: ${data.get('nombre')}\nCorreo: ${data.get('correo')}\n\nNecesidad:\n${data.get('mensaje')}`;
    window.location.href = `mailto:contacto@vbmconsulting.es?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}
