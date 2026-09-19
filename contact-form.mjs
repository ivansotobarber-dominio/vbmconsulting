// Public configuration only. Never put provider API keys in the browser.
// Operational release switch, not a certification of legal compliance.
export const contactConfig = { endpoint: 'https://formspree.io/f/mbgllrqo', submissionEnabled: true };

const mountedForms = new WeakMap();

export function isContactReady(config) {
  return config.submissionEnabled === true && /^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(config.endpoint);
}

export function mountContactForm(form, config = contactConfig) {
  mountedForms.get(form)?.();
  const fields = form.querySelector('fieldset');
  const status = form.querySelector('[data-contact-status]');
  const ready = isContactReady(config);
  let pending = false;
  let controller;
  let disposed = false;
  let retryAt = 0;
  fields.disabled = !ready;
  const report = (message) => { if (!disposed) status.textContent = message; };
  report(ready ? 'No incluya datos sensibles ni documentos confidenciales.' : 'El envio desde la web no esta disponible. Puede escribir al correo de contacto.');
  const submit = async (event) => {
    event.preventDefault();
    if (!ready || pending) return;
    if (Date.now() < retryAt) {
      report('Limite de envios alcanzado. Espere antes de reintentar o use el correo.');
      return;
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    if (String(data.get('_gotcha') || '').trim()) {
      report('No se ha enviado la consulta. Revise el formulario o use el correo de contacto.');
      return;
    }
    for (const name of ['nombre', 'email', 'mensaje']) {
      const field = form.elements.namedItem(name);
      field.value = field.value.trim();
      data.set(name, field.value);
      if (!field.value) { field.reportValidity(); field.focus(); return; }
    }
    if (!form.reportValidity()) return;
    pending = true;
    fields.disabled = true;
    form.setAttribute('aria-busy', 'true');
    report('Enviando consulta...');
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST', body: data, headers: { Accept: 'application/json' },
        credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers?.get('Retry-After');
          const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : NaN;
          const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter || '') - Date.now();
          retryAt = Date.now() + Math.max(1000, Number.isFinite(delay) ? delay : 60000);
        }
        report(response.status === 429 ? 'Limite de envios alcanzado. Espere antes de reintentar o use el correo.' : 'El proveedor no ha aceptado la consulta. Revise los datos o use el correo.');
        return;
      }
      const result = await response.json();
      if (result.ok !== true) throw new Error('Unconfirmed response');
      if (disposed) return;
      form.reset();
      report('El proveedor ha aceptado la consulta. Esto no confirma su recepcion en el buzon.');
    } catch {
      report('No se pudo confirmar el envio. Puede haberse recibido; compruebelo antes de reintentar. Sus datos siguen en el formulario.');
    } finally {
      clearTimeout(timeout);
      pending = false;
      if (!disposed) {
        fields.disabled = false;
        form.setAttribute('aria-busy', 'false');
      }
    }
  };
  form.addEventListener('submit', submit);
  const cleanup = () => {
    disposed = true;
    form.removeEventListener('submit', submit);
    controller?.abort();
    form.setAttribute('aria-busy', 'false');
    if (mountedForms.get(form) === cleanup) mountedForms.delete(form);
  };
  mountedForms.set(form, cleanup);
  return cleanup;
}
