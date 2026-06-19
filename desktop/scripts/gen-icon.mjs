// Génère l'icône source (1024×1024 PNG) à partir d'un SVG « croissant HILAL ».
// Ensuite `tauri icon src-tauri/icon-source.png` produit tout le jeu d'icônes
// (ico/icns/png). Lancé via `npm run icon`. Couleurs alignées sur le thème sombre.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../src-tauri/icon-source.png');

const svg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <mask id="crescent">
      <rect width="1024" height="1024" fill="black"/>
      <circle cx="470" cy="512" r="300" fill="white"/>
      <circle cx="600" cy="466" r="270" fill="black"/>
    </mask>
  </defs>
  <rect width="1024" height="1024" rx="190" fill="#0E1A16"/>
  <g mask="url(#crescent)"><rect width="1024" height="1024" fill="#C9A24B"/></g>
</svg>`;

await sharp(Buffer.from(svg)).resize(1024, 1024).png().toFile(out);
console.log('Icône source générée :', out);
