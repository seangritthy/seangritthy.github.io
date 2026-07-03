/**
 * Local dev server for GitHub Movies.
 *
 * - Serves the static site (play.html, index.html, ...).
 * - Exposes GET /api/extract?tmdb=..&type=movie|tv[&season=&episode=]
 *   which uses a headless Chromium (Playwright) to open the vsembed embed page,
 *   bypass bot checks, and INTERCEPT the cloudorchestranova.com/rcp/<token> URL
 *   (the ad-free CloudNestra player), mirroring the Android WebView approach.
 *
 * Run:
 *   npm install         (downloads Chromium via postinstall)
 *   npm start
 *   open http://localhost:3000/play.html?tmdb=793387&type=movie
 */

const path = require('path');
const express = require('express');
const { chromium } = require('playwright');

const PORT = process.env.PORT || 3000;
const NAV_TIMEOUT = 30000;   // ms to reach the page
const CATCH_TIMEOUT = 28000; // ms to wait for the rcp request

const app = express();

// CORS so the resolver also works if the site is hosted elsewhere (e.g. github.io).
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// A single reusable browser instance for speed.
let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ]
    });
  }
  return browserPromise;
}

const RCP_RE = /(cloudorchestranova|cloudnestra)\.com\/rcp\/[A-Za-z0-9+/=_-]+/i;

// Browser-like headers so vsembed serves the real embed HTML.
const EMBED_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://vsembed.ru/'
};

function normalizeRcp(match) {
  if (!match) return null;
  return match.startsWith('http') ? match : `https://${match}`;
}

// Free public relays that fetch a target URL from THEIR IP (not ours) and
// return the raw body. This routes around vsembed's Cloudflare 1020 ban on
// datacenter IPs. Each entry maps a target URL to a relay request.
const RELAYS = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`
];

async function fetchText(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: EMBED_HEADERS, redirect: 'follow', signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Fetch the embed HTML and pull the ad-free cloudorchestranova.com/rcp/<token>
// URL out of it. Tries a direct request first, then falls back through the free
// relays (whose IPs aren't blocked by vsembed's Cloudflare firewall).
async function fetchRcpDirect(embedUrl) {
  if (typeof fetch !== 'function') return null;

  // 1) Direct (works from residential IPs / non-blocked hosts).
  let html = await fetchText(embedUrl, 15000);
  let m = html && html.match(RCP_RE);
  if (m) return normalizeRcp(m[0]);

  // 2) Via relays (each fetches vsembed from its own IP).
  for (const relay of RELAYS) {
    html = await fetchText(relay(embedUrl), 22000);
    m = html && html.match(RCP_RE);
    if (m) return normalizeRcp(m[0]);
  }
  return null;
}


// Hosts we never need — abort them to speed things up and cut noise.
const AD_HINTS = ['doubleclick', 'googlesyndication', 'google-analytics', 'googletagmanager',
  'adservice', 'popads', 'propeller', 'onclicka', 'adsterra', 'exoclick', 'juicyads',
  'facebook.net', 'analytics', 'hotjar', 'histats'];

function buildEmbedUrl(tmdb, mediaType, season, episode) {
  if (mediaType === 'tv') {
    return `https://vsembed.ru/embed/tv/${tmdb}/${season || '1'}/${episode || '1'}`;
  }
  return `https://vsembed.ru/embed/movie/${tmdb}/`;
}

async function resolveRcp(embedUrl) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    extraHTTPHeaders: {
      Referer: 'https://vsembed.ru/',
      Origin: 'https://vsembed.ru'
    }
  });

  // Mask automation fingerprints (bot-check bypass).
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Plugin', filename: 'chrome-pdf-plugin' }
      ]
    });
  });

  const page = await context.newPage();

  let found = null;
  let resolveFound;
  const foundPromise = new Promise((r) => (resolveFound = r));
  const check = (url) => {
    if (!found && url && RCP_RE.test(url)) {
      found = url.match(RCP_RE)[0];
      if (!found.startsWith('http')) found = `https://${found}`;
      resolveFound(found);
    }
  };

  // Intercept every request; capture the rcp URL, drop ad hosts.
  await page.route('**/*', (route) => {
    const url = route.request().url();
    check(url);
    const low = url.toLowerCase();
    if (AD_HINTS.some((h) => low.includes(h))) return route.abort().catch(() => {});
    return route.continue().catch(() => {});
  });
  page.on('request', (req) => check(req.url()));
  page.on('response', (resp) => check(resp.url()));
  page.on('frameattached', (frame) => check(frame.url()));

  try {
    await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT }).catch(() => {});

    // Nudge the player: remove overlays, click play buttons.
    await page.evaluate(() => {
      ['.ad', '.ads', '.modal', '.popup', '.overlay', '[id*="google_ads"]'].forEach((sel) =>
        document.querySelectorAll(sel).forEach((el) => el.remove())
      );
      ['.vjs-big-play-button', '.jw-display-icon-container', '.play-button',
        '#play-button', 'button[class*="play"]', '.vjs-poster'].forEach((s) =>
        document.querySelectorAll(s).forEach((btn) => {
          try { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
        })
      );
    }).catch(() => {});

    // As a fallback, scan the DOM (and any child frames) for the rcp URL.
    if (!found) {
      const html = await page.content().catch(() => '');
      check(html.match(RCP_RE)?.[0] || '');
      for (const frame of page.frames()) {
        check(frame.url());
      }
    }

    // Wait until the rcp request appears (or timeout).
    const result = await Promise.race([
      foundPromise,
      page.waitForTimeout(CATCH_TIMEOUT).then(() => null)
    ]);

    return result || found;
  } finally {
    await context.close().catch(() => {});
  }
}

app.get('/api/extract', async (req, res) => {
  const { tmdb, type, season, episode } = req.query;
  if (!tmdb) return res.status(400).json({ success: false, error: 'TMDB ID is required' });

  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const embedUrl = buildEmbedUrl(tmdb, mediaType, season, episode);

  try {
    // 1) Fast path: plain fetch + regex (no browser).
    let url = await fetchRcpDirect(embedUrl);
    // 2) Fallback: headless Chromium (handles JS-rendered / bot-checked pages).
    if (!url) url = await resolveRcp(embedUrl);
    if (url) {
      return res.status(200).json({
        success: true,
        url,
        tmdb_id: tmdb,
        media_type: mediaType,
        provider: 'cloudnestra',
        source: embedUrl
      });
    }
    return res.status(404).json({
      success: false,
      error: 'Could not resolve a cloudorchestranova.com/rcp URL from the embed page.',
      embedUrl
    });
  } catch (error) {
    console.error('[extract] error:', error);
    return res.status(500).json({ success: false, error: error?.message || String(error) });
  }
});

// Lightweight health check (used by Render). Does NOT launch a browser.
app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

// Build/version marker so we can confirm which code Render is serving.
const BUILD_ID = 'relay-1';
app.get('/version', (req, res) => res.status(200).json({ build: BUILD_ID }));

// Browser probe: load an arbitrary URL in headless Chromium, wait for any
// Cloudflare "Just a moment" challenge to clear, then report the resulting
// title, iframe srcs, and whether an rcp/prorcp URL appeared.
app.get('/api/bprobe', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'url query param required' });
  const waitMs = Math.min(parseInt(req.query.wait || '12000', 10) || 12000, 25000);
  const out = { target };
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US'
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });
  const page = await context.newPage();
  const seen = [];
  const rcpLike = /(cloudorchestranova|cloudnestra)\.com\/(rcp|prorcp)\/[A-Za-z0-9+/=_-]+/i;
  const note = (u) => { if (u && rcpLike.test(u) && !seen.includes(u)) seen.push(u.match(rcpLike)[0]); };
  page.on('request', (r) => note(r.url()));
  page.on('response', (r) => note(r.url()));
  page.on('frameattached', (f) => note(f.url()));
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(waitMs);
    const html = await page.content().catch(() => '');
    out.title = await page.title().catch(() => '');
    out.finalUrl = page.url();
    out.stillChallenged = /just a moment/i.test(out.title) || /just a moment/i.test(html);
    out.iframeSrcs = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]).slice(0, 10);
    note(html.match(rcpLike)?.[0] || '');
    for (const f of page.frames()) note(f.url());
    out.rcpSeen = seen.slice(0, 5);
  } catch (e) {
    out.error = e?.name + ': ' + (e?.message || String(e));
  } finally {
    await context.close().catch(() => {});
  }
  return res.status(200).json(out);
});

// Generic probe: fetch an arbitrary URL from the server IP and report status +
// a snippet. Lets us test provider reachability without redeploying each time.
app.get('/api/probe', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'url query param required' });
  const out = { target };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000);
    const r = await fetch(target, { headers: EMBED_HEADERS, redirect: 'follow', signal: controller.signal });
    clearTimeout(t);
    const html = await r.text();
    out.status = r.status;
    out.server = r.headers.get('server');
    out.contentType = r.headers.get('content-type');
    out.htmlLen = html.length;
    out.title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').slice(0, 100);
    out.cf = cfMarkers(html);
    out.iframeSrcs = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]).slice(0, 8);
    out.snippet = html.slice(0, 300);
  } catch (e) {
    out.error = e?.name + ': ' + (e?.message || String(e));
  }
  return res.status(200).json(out);
});

function cfMarkers(html) {
  const low = (html || '').toLowerCase();
  return {
    justAMoment: low.includes('just a moment'),
    challengePlatform: low.includes('challenge-platform') || low.includes('cf-challenge'),
    attentionRequired: low.includes('attention required'),
    error1020: low.includes('error 1020') || low.includes('ray id'),
    cfmail: low.includes('cloudflare')
  };
}

// Diagnostic: compare a plain fetch vs a real headless-browser fetch from the
// server's IP, and classify any Cloudflare block (challenge vs hard ban).
app.get('/api/debug', async (req, res) => {
  const { tmdb = '793387', type } = req.query;
  const mediaType = type === 'tv' ? 'tv' : 'movie';
  const embedUrl = buildEmbedUrl(tmdb, mediaType, req.query.season, req.query.episode);
  const out = { build: BUILD_ID, embedUrl };

  // (a) plain fetch
  out.fetch = {};
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    const r = await fetch(embedUrl, { headers: EMBED_HEADERS, signal: controller.signal });
    clearTimeout(t);
    const html = await r.text();
    out.fetch.status = r.status;
    out.fetch.server = r.headers.get('server');
    out.fetch.htmlLen = html.length;
    out.fetch.rcpFound = RCP_RE.test(html);
    out.fetch.cf = cfMarkers(html);
    out.fetch.title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').slice(0, 80);
  } catch (e) {
    out.fetch.error = e?.name + ': ' + (e?.message || String(e));
  }

  // (b) real browser (Playwright) — can solve JS challenges if it's not a hard ban
  out.browser = {};
  try {
    const url = await resolveRcp(embedUrl);
    out.browser.rcpFound = Boolean(url);
    out.browser.rcpSample = url ? url.slice(0, 60) : null;
  } catch (e) {
    out.browser.error = e?.name + ': ' + (e?.message || String(e));
  }

  return res.status(200).json(out);
});

// Serve the static site (play.html, index.html, assets, ...).
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`\n  GitHub Movies dev server running:`);
  console.log(`  → http://localhost:${PORT}/play.html?tmdb=793387&type=movie\n`);
});
