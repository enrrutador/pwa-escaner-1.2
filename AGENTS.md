# Workflow

## Commit & Push
```bash
git add src/ public/
git commit -m "tipo: descripción"
git push
```

No commitear `.next/`, `node_modules/`, `.env`.

## Build
```bash
npm run build
```

## Deploy a Vercel
```bash
npx vercel --prod
```

El deploy se alínea automáticamente a `https://stockmaster-eta.vercel.app`.

## Tecnologías
- Next.js 14 (App Router)
- Dexie.js (IndexedDB)
- Zustand (estado global)
- Tailwind v4 (`@import "tailwindcss"`)
- ZXing (`@zxing/library` v0.23, import dinámico)
- Chart.js (dashboard)

## Scanner
- `src/components/scanner/BarcodeScanner.tsx` — cámara + ZXing, import dinámico.
- `src/app/scanner/page.tsx` — orquestador (busca local → web → redirige).
- ZXing se carga bajo demanda (`import('@zxing/library')`), no entra en el bundle inicial.

## API
- `/api/buscar` — VTEX intelligent search + Coto Constructor.io.

## Git
- Remote: `https://github.com/enrrutador/pwa-escaner-1.2`
- Siempre commitear ANTES de cerrar sesión.
