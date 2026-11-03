const scene = document.querySelector('#scene');
const start = async () => {
  scene.setAttribute('aria-busy', 'true');
  try {
    const { mountScene } = await import('./scene.mjs');
    await mountScene(scene);
  } catch (error) {
    scene.classList.remove('ready');
    scene.setAttribute('aria-busy', 'false');
    scene.dataset.state = 'fallback';
  }
};
if ('requestIdleCallback' in window) requestIdleCallback(start, {timeout: 900});
else setTimeout(start, 80);
