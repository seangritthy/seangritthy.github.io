import puppeteer from '@cloudflare/puppeteer';

// Cloudflare Worker resolver: GitHub Pages front-end -> this Worker -> vsembed
// -> captures the ad-free cloudorchestranova.com/rcp/<token> URL and returns it.
// Requires the Browser Rendering binding (see wrangler.toml).

const RCP_RE = /(cloudorchestranova|cloudnestra)\.com\/rcp\/[A-Za-z0-9+/=_-]+/i;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS }
  });
}

function buildEmbedUrl(tmdb, type, season, episode) {
  return type === 'tv'
    ? `https://vsembed.ru/embed/tv/${tmdb}/${season || '1'}/${episode || '1'}`
    : `https://vsembed.ru/embed/movie/${tmdb}/`;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    if (url.pathname !== '/api/extract') {
      return json({ success: false, error: 'Not found' }, 404);
    }

    const tmdb = url.searchParams.get('tmdb');
    const type = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
    const season = url.searchParams.get('season') || '1';
    const episode = url.searchParams.get('episode') || '1';
    if (!tmdb) return json({ success: false, error: 'TMDB ID is required' }, 400);

    const embedUrl = buildEmbedUrl(tmdb, type, season, episode);

    let browser;
    try {
      browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
      );
      await page.setExtraHTTPHeaders({
        Referer: 'https://vsembed.ru/',
        'Accept-Language': 'en-US,en;q=0.9'
      });

      let found = null;
      const check = (u) => {
        if (!found && u && RCP_RE.test(u)) {
          found = u.match(RCP_RE)[0];
          if (!found.startsWith('http')) found = `https://${found}`;
        }
      };
      page.on('request', (req) => check(req.url()));
      page.on('response', (resp) => check(resp.url()));
      page.on('framenavigated', (frame) => check(frame.url()));

      await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

      // Nudge the player: remove overlays, click play buttons.
      await page.evaluate(() => {
        ['.ad', '.ads', '.modal', '.popup', '.overlay', '[id*="google_ads"]'].forEach((sel) =>
          document.querySelectorAll(sel).forEach((el) => el.remove())
        );
        ['.vjs-big-play-button', '.jw-display-icon-container', '.play-button',
          '#play-button', 'button[class*="play"]', '.vjs-poster', '#player_iframe'].forEach((s) =>
          document.querySelectorAll(s).forEach((btn) => {
            try { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
          })
        );
      }).catch(() => {});

      // Poll up to ~20s for the rcp URL (request or child-frame src).
      for (let i = 0; i < 40 && !found; i++) {
        await new Promise((r) => setTimeout(r, 500));
        for (const frame of page.frames()) check(frame.url());
      }

      // Last resort: scan the rendered DOM.
      if (!found) {
        const html = await page.content().catch(() => '');
        const m = html.match(RCP_RE);
        if (m) found = m[0];
      }

      await browser.close();

      if (found) {
        return json({ success: true, url: found, tmdb_id: tmdb, media_type: type, provider: 'cloudnestra', source: embedUrl });
      }
      return json({ success: false, error: 'Could not resolve a cloudorchestranova.com/rcp URL.', embedUrl }, 404);
    } catch (error) {
      if (browser) await browser.close().catch(() => {});
      return json({ success: false, error: error?.message || String(error) }, 500);
    }
  }
};
