const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const files = [
  'CNAME', 'aviso-legal.html', 'bbl-automatizacion-documental.html',
  'casesignal-seleccion-talento.html', 'cookies.html', 'index.html',
  'ingenieria-de-caminos.html', 'privacidad.html', 'digital-products.css',
  'experience.css', 'modern.css', 'studio.css', 'styles.css',
  'main.js', 'contact-form.mjs', 'modern.js', 'favicon.svg', 'llms.txt', 'robots.txt',
  'site.webmanifest', 'sitemap.xml', 'assets/vbm-territory-bim-v01.png',
  'assets/video/vbm-territorio-bim-loop-v01.mp4',
  'assets/video/vbm-territorio-bim-reference-v01.png',
  'web.html', 'assets/entry-routes.js',
  'assets/landing-3d/landing.css', 'assets/landing-3d/landing.mjs',
  'assets/landing-3d/scene.mjs', 'assets/landing-3d/fallback.png',
  'assets/landing-3d/fallback-mobile.png',
  'assets/landing-3d/vendor/three.module.min.js',
  'assets/landing-3d/vendor/three.core.min.js',
  'assets/landing-3d/vendor/RoundedBoxGeometry.js',
  'assets/landing-3d/vendor/LICENSE',
  'assets/landing-3d/icons/arrow-up-right.svg', 'assets/landing-3d/icons/LICENSE',
];

function packagePublic(destination) {
  const root = path.resolve(__dirname, '..');
  const out = path.resolve(root, destination);
  if (!out.startsWith(path.join(root, 'output') + path.sep)) throw Error('Destination must be inside output');
  if (fs.existsSync(out)) throw Error('Destination already exists; use a fresh directory');
  const inventory = files.map(name => {
    const source = path.join(root, name);
    if (!fs.lstatSync(source).isFile() || fs.realpathSync(source) !== source) throw Error('Invalid public source: ' + name);
    const bytes = fs.readFileSync(source);
    if (/\.(html|css|m?js|txt|svg|xml|webmanifest)$/.test(name) && /-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|sk-proj-[A-Za-z0-9]{20,}/.test(bytes.toString())) throw Error('Possible secret in public source');
    return { name, bytes, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  });
  for (const { name, bytes } of inventory) {
    const target = path.join(out, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx' });
  }
  return inventory.map(({ name, sha256 }) => ({ name, sha256 }));
}

if (require.main === module) console.log(JSON.stringify(packagePublic(process.argv[2] || 'output/public-site'), null, 2));
module.exports = { files, packagePublic };
