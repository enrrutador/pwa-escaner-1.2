// Script para generar iconos PNG para PWA
const fs = require('fs');
const path = require('path');

// Minimal PNG generator - creates solid color PNG
function createPNG(size, r, g, b) {
  // We'll create a simple SVG and note that for real usage,
  // the user should replace these with proper designed icons
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="oklch(18% 0.03 262)"/>
  <text x="50%" y="48%" text-anchor="middle" dominant-baseline="central" 
        font-family="Inter,system-ui,sans-serif" font-weight="800" 
        font-size="${size * 0.35}" fill="oklch(72% 0.13 258)">S</text>
  <text x="50%" y="72%" text-anchor="middle" dominant-baseline="central" 
        font-family="Inter,system-ui,sans-serif" font-weight="600" 
        font-size="${size * 0.1}" fill="oklch(78% 0.025 262)">STOCKMASTER</text>
</svg>`;
  return svg;
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// Generate SVG icons (browsers support SVG in manifest for modern PWAs)
fs.writeFileSync(path.join(iconsDir, 'icon-192.svg'), createPNG(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.svg'), createPNG(512));

// Generate maskable versions with more padding
function createMaskableSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="oklch(18% 0.03 262)"/>
  <circle cx="${size/2}" cy="${size*0.42}" r="${size*0.22}" fill="oklch(72% 0.13 258)" opacity="0.15"/>
  <text x="50%" y="46%" text-anchor="middle" dominant-baseline="central" 
        font-family="Inter,system-ui,sans-serif" font-weight="800" 
        font-size="${size * 0.32}" fill="oklch(72% 0.13 258)">S</text>
  <text x="50%" y="72%" text-anchor="middle" dominant-baseline="central" 
        font-family="Inter,system-ui,sans-serif" font-weight="700" 
        font-size="${size * 0.085}" fill="oklch(92% 0.03 262)" letter-spacing="${size*0.008}">STOCKMASTER</text>
</svg>`;
}

fs.writeFileSync(path.join(iconsDir, 'icon-192-maskable.svg'), createMaskableSVG(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512-maskable.svg'), createMaskableSVG(512));

console.log('Iconos SVG creados en public/icons/');
console.log('NOTA: Para producción, reemplaza estos SVGs con PNGs reales diseñados.');
console.log('Puedes usar https://app-manifest.firebaseapp.com/ para generarlos.');
