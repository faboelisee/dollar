#!/usr/bin/env node
/**
 * Télécharge les assets externes (Chart.js + Google Fonts)
 * nécessaires pour le fonctionnement hors-ligne de l'application.
 *
 * Exécuter UNE SEULE FOIS avant npm run build :
 *   node scripts/download-assets.js
 */
'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const FONTS_DIR  = path.join(ASSETS_DIR, 'fonts');

fs.mkdirSync(FONTS_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  const tasks = [
    // Chart.js
    {
      url: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
      dest: path.join(ASSETS_DIR, 'chart.min.js'),
      label: 'Chart.js 4.4.1',
    },
    // Cormorant Garamond
    { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v22/co3YmX5slCNuHLi8bLeY9MK7whWMhyjYrEPjuw.woff2',       dest: path.join(FONTS_DIR, 'CormorantGaramond-Regular.woff2'),         label: 'Cormorant Garamond Regular' },
    { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v22/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYrEtUqQ.woff2',      dest: path.join(FONTS_DIR, 'CormorantGaramond-Medium.woff2'),          label: 'Cormorant Garamond Medium' },
    { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v22/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqkxUqQ.woff2',      dest: path.join(FONTS_DIR, 'CormorantGaramond-SemiBold.woff2'),        label: 'Cormorant Garamond SemiBold' },
    { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v22/co3YmX5slCNuHLi8bLeY9MK7whWMhyjYqELjuw.woff2',      dest: path.join(FONTS_DIR, 'CormorantGaramond-Bold.woff2'),            label: 'Cormorant Garamond Bold' },
    { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v22/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjQEl5Xug.woff2',      dest: path.join(FONTS_DIR, 'CormorantGaramond-Italic.woff2'),          label: 'Cormorant Garamond Italic' },
    { url: 'https://fonts.gstatic.com/s/cormorantgaramond/v22/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjQEl5Xug.woff2',      dest: path.join(FONTS_DIR, 'CormorantGaramond-SemiBoldItalic.woff2'), label: 'Cormorant Garamond SemiBold Italic' },
    // DM Mono
    { url: 'https://fonts.gstatic.com/s/dmmono/v14/aFTU7PB1QTsUX8KYth-orYataIf4.woff2',  dest: path.join(FONTS_DIR, 'DMMono-Light.woff2'),   label: 'DM Mono Light' },
    { url: 'https://fonts.gstatic.com/s/dmmono/v14/aFTR7PB1QTsUX8KYvrGyIYSnbKX9.woff2', dest: path.join(FONTS_DIR, 'DMMono-Regular.woff2'), label: 'DM Mono Regular' },
    { url: 'https://fonts.gstatic.com/s/dmmono/v14/aFTU7PB1QTsUX8KYthuqrYataIf4.woff2', dest: path.join(FONTS_DIR, 'DMMono-Medium.woff2'),  label: 'DM Mono Medium' },
    // Spectral
    { url: 'https://fonts.gstatic.com/s/spectral/v13/rnCs-xNNww_2s0amA9M9knj-SA.woff2',         dest: path.join(FONTS_DIR, 'Spectral-Light.woff2'),        label: 'Spectral Light' },
    { url: 'https://fonts.gstatic.com/s/spectral/v13/rnCr-xNNww_2s0amA9M8qrNC.woff2',           dest: path.join(FONTS_DIR, 'Spectral-Regular.woff2'),      label: 'Spectral Regular' },
    { url: 'https://fonts.gstatic.com/s/spectral/v13/rnCs-xNNww_2s0amA9M5lHj-SA.woff2',         dest: path.join(FONTS_DIR, 'Spectral-SemiBold.woff2'),     label: 'Spectral SemiBold' },
    { url: 'https://fonts.gstatic.com/s/spectral/v13/rnCt-xNNww_2s0amA9M2qtbc_A.woff2',         dest: path.join(FONTS_DIR, 'Spectral-LightItalic.woff2'),  label: 'Spectral Light Italic' },
  ];

  console.log(`\nTéléchargement de ${tasks.length} assets…\n`);
  let ok = 0, ko = 0;

  for (const t of tasks) {
    process.stdout.write(`  ${t.label.padEnd(40)} `);
    try {
      await download(t.url, t.dest);
      const size = fs.statSync(t.dest).size;
      console.log(`✓  (${(size / 1024).toFixed(1)} KB)`);
      ok++;
    } catch (e) {
      console.log(`✗  ERREUR: ${e.message}`);
      ko++;
    }
  }

  console.log(`\n${ok} fichier(s) téléchargé(s)${ko ? `, ${ko} échec(s)` : ''}.\n`);
  if (ko) {
    console.log('En cas d\'échec, téléchargez manuellement les fichiers manquants dans assets/fonts/\n');
    process.exit(1);
  }
}

main().catch(console.error);
