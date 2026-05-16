/* eslint-disable @typescript-eslint/no-require-imports -- script Node CJS de build, rodado via `node scripts/generate-icons.js` */
/**
 * Gera os assets de marca do TôOrganizado a partir da identidade visual oficial
 * (exportada do Claude Design).
 *
 * - O ÍCONE é um SVG vetorial puro (sem fonte) — embutido aqui e rasterizado em
 *   tamanho exato, então fica perfeitamente nítido em qualquer resolução.
 * - Os LOGOS COM WORDMARK ("TôOrganizado") usam fontes woff2 embutidas nos HTMLs,
 *   então são renderizados via Chrome headless (puppeteer-core + Chrome do sistema).
 *   O screenshot mira só o elemento do logo — a legenda do card de design e o
 *   fundo branco do card são removidos antes da captura.
 *
 * Uso: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const APP = path.join(ROOT, 'app');
const SRC = '/Users/anderson/Documents/gastometro arquivos';
const HORIZONTAL_HTML = path.join(SRC, '01 _ Horizontal.html');
const VERTICAL_HTML = path.join(SRC, '02 _ Vertical.html');
const MONO_HTML = path.join(SRC, '06 _ Mono horizontal.html');

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Ícone vetorial oficial. rx=112 → cantos arredondados (favicon/og/wordmark);
 *  rx=0 → quadrado cheio (PWA/Apple, o SO aplica a própria máscara). */
const iconSvg = (rx) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect width="512" height="512" rx="${rx}" fill="#5B5BD6"/>
<rect x="104" y="156" width="148" height="34" rx="17" fill="#FFFFFF"/>
<rect x="104" y="239" width="148" height="34" rx="17" fill="#FFFFFF"/>
<rect x="104" y="322" width="148" height="34" rx="17" fill="#FFFFFF"/>
<path d="M 284 272 L 332 320 L 416 200" stroke="#FFFFFF" stroke-width="40" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
const ICON_ROUNDED = iconSvg(112);
const ICON_FULLBLEED = iconSvg(0);

/** Rasteriza um SVG num PNG de tamanho exato. opaque=false → cantos transparentes. */
async function renderSvgToPng(browser, svg, size, outPath, opaque) {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>
      *{margin:0;padding:0}html,body{width:${size}px;height:${size}px;overflow:hidden}
      svg{display:block;width:${size}px;height:${size}px}
    </style>${svg}`,
    { waitUntil: 'load' }
  );
  const buf = await page.screenshot({
    type: 'png',
    omitBackground: !opaque,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  await page.close();
  if (outPath) {
    fs.writeFileSync(outPath, buf);
    console.log('  gerado:', path.relative(ROOT, outPath), `(${size}x${size})`);
  }
  return buf;
}

/** Monta um .ico real (PNG embutido) a partir de PNGs 16/32/48. */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: 1 = ícone
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(images.length * 16);
  let offset = 6 + images.length * 16;
  images.forEach((img, i) => {
    const b = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 0); // largura
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 1); // altura
    dir.writeUInt8(0, b + 2); // paleta
    dir.writeUInt8(0, b + 3); // reservado
    dir.writeUInt16LE(1, b + 4); // planos
    dir.writeUInt16LE(32, b + 6); // bits por pixel
    dir.writeUInt32LE(img.buf.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += img.buf.length;
  });
  return Buffer.concat([header, dir, ...images.map((x) => x.buf)]);
}

/** Abre o HTML do logo, espera as fontes, remove a legenda + fundo do card e
 *  captura SÓ o elemento do logo em PNG transparente de alta resolução. */
async function screenshotLogo(browser, htmlFile, outPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 3 });
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const el of [
      document.documentElement,
      document.body,
      ...document.querySelectorAll('.dc-card, .ab-frame'),
    ]) {
      el.style.background = 'transparent';
      el.style.backgroundColor = 'transparent';
      el.style.boxShadow = 'none';
    }
    document.querySelectorAll('.caption').forEach((c) => c.remove());
  });
  await new Promise((r) => setTimeout(r, 500));
  const el = await page.$('.ab-frame > div:first-child');
  if (!el) throw new Error('logo não encontrado em ' + htmlFile);
  const buf = await el.screenshot({ type: 'png', omitBackground: true });
  await page.close();
  if (outPath) {
    fs.writeFileSync(outPath, buf);
    console.log('  gerado:', path.relative(ROOT, outPath));
  }
  return buf;
}

/** Compõe a OG image 1200x630: logo horizontal centralizado em fundo branco. */
async function composeOG(browser, logoBuf, outPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  const b64 = logoBuf.toString('base64');
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;width:1200px;height:630px}
      .wrap{width:1200px;height:630px;display:flex;align-items:center;justify-content:center;background:#FFFFFF}
      img{width:680px;height:auto;display:block}
    </style><div class="wrap"><img src="data:image/png;base64,${b64}"></div>`,
    { waitUntil: 'load' }
  );
  const buf = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  await page.close();
  fs.writeFileSync(outPath, buf);
  console.log('  gerado:', path.relative(ROOT, outPath), '(1200x630)');
}

async function main() {
  for (const f of [HORIZONTAL_HTML, VERTICAL_HTML, MONO_HTML]) {
    if (!fs.existsSync(f)) throw new Error('HTML de origem não encontrado: ' + f);
  }
  if (!fs.existsSync(CHROME))
    throw new Error('Chrome não encontrado em ' + CHROME + ' (defina CHROME_PATH)');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--force-color-profile=srgb'],
  });
  try {
    // ── Ícone (SVG vetorial puro) ──────────────────────────────────────────
    console.log('Ícones:');
    fs.writeFileSync(path.join(APP, 'icon.svg'), ICON_ROUNDED + '\n');
    console.log('  gerado: app/icon.svg (vetorial, sizes=any)');

    await renderSvgToPng(browser, ICON_FULLBLEED, 512, path.join(PUB, 'icon-512.png'), true);
    await renderSvgToPng(browser, ICON_FULLBLEED, 192, path.join(PUB, 'icon-192.png'), true);
    await renderSvgToPng(browser, ICON_FULLBLEED, 180, path.join(APP, 'apple-icon.png'), true);

    const ico = [];
    for (const s of [16, 32, 48]) {
      ico.push({ size: s, buf: await renderSvgToPng(browser, ICON_ROUNDED, s, null, false) });
    }
    fs.writeFileSync(path.join(APP, 'favicon.ico'), buildIco(ico));
    console.log('  gerado: app/favicon.ico (16/32/48, ICO real)');

    // ── Wordmark + OG (Chrome com fontes embutidas) ────────────────────────
    console.log('Wordmark + OG:');
    const horiz = await screenshotLogo(browser, HORIZONTAL_HTML, path.join(PUB, 'logo-horizontal.png'));
    await screenshotLogo(browser, VERTICAL_HTML, path.join(PUB, 'logo-vertical.png'));
    await screenshotLogo(browser, MONO_HTML, path.join(PUB, 'logo-mono.png'));
    await composeOG(browser, horiz, path.join(APP, 'opengraph-image.png'));
    fs.copyFileSync(path.join(APP, 'opengraph-image.png'), path.join(APP, 'twitter-image.png'));
    console.log('  gerado: app/twitter-image.png (cópia da OG)');

    console.log('\nTodos os assets gerados.');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
