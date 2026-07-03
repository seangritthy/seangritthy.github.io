export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { tmdb, type, season, episode } = req.query;

    if (!tmdb) {
        return res.status(400).json({ success: false, error: 'TMDB ID is required' });
    }

    const mediaType = type === 'tv' ? 'tv' : 'movie';

    // Build the vsembed embed URL. TV needs season/episode; default to 1/1.
    const s = season || '1';
    const e = episode || '1';
    const embedUrl = mediaType === 'tv'
        ? `https://vsembed.ru/embed/tv/${tmdb}/${s}/${e}`
        : `https://vsembed.ru/embed/movie/${tmdb}/`;

    try {
        // Step 1: fetch the vsembed embed page (must look like a real browser).
        const response = await fetch(embedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Referer': 'https://vsembed.ru/',
                'Origin': 'https://vsembed.ru',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            return res.status(502).json({
                success: false,
                error: `Embed source returned HTTP ${response.status}`,
                embedUrl
            });
        }

        const html = await response.text();

        // Step 2: scrape the CloudNestra player URL out of the page.
        // vsembed embeds it as https://cloudorchestranova.com/rcp/<base64-token>
        // (this is the current host; cloudnestra.com is the legacy fallback).
        // The token is URL-safe base64: letters, digits, + / = _ -.
        const TOKEN = '[A-Za-z0-9+/=_-]+';
        const patterns = [
            // Absolute URL with the known hosts
            new RegExp(`https?:\\/\\/[^"'\\s\\\\]*cloudorchestranova\\.com\\/rcp\\/${TOKEN}`, 'i'),
            new RegExp(`https?:\\/\\/[^"'\\s\\\\]*cloudnestra\\.com\\/rcp\\/${TOKEN}`, 'i'),
            // Protocol-relative //host/rcp/token
            new RegExp(`\\/\\/[^"'\\s\\\\]*cloudorchestranova\\.com\\/rcp\\/${TOKEN}`, 'i'),
            new RegExp(`\\/\\/[^"'\\s\\\\]*cloudnestra\\.com\\/rcp\\/${TOKEN}`, 'i'),
            // iframe src pointing at either host
            /<iframe[^>]*src=["']([^"']*(?:cloudorchestranova|cloudnestra)[^"']*)["']/i,
            // Any /rcp/<token> found in a src="" attribute
            new RegExp(`src=["']([^"']*\\/rcp\\/${TOKEN})["']`, 'i'),
            // Any /rcp/<token> found inside a quoted JSON/JS string
            new RegExp(`["'](https?:)?\\/\\/[^"'\\s]*\\/rcp\\/${TOKEN}["']`, 'i')
        ];

        let rcpUrl = null;
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match) {
                rcpUrl = (match[1] || match[0]).trim();
                if (rcpUrl && /\/rcp\//i.test(rcpUrl)) break;
            }
        }

        if (!rcpUrl) {
            return res.status(404).json({
                success: false,
                error: 'No CloudNestra (rcp) URL found on the embed page.',
                embedUrl
            });
        }

        // Step 3: normalize the URL.
        rcpUrl = rcpUrl.replace(/^["']|["']$/g, '').replace(/&amp;/g, '&');
        if (rcpUrl.startsWith('//')) rcpUrl = `https:${rcpUrl}`;

        return res.status(200).json({
            success: true,
            url: rcpUrl,
            tmdb_id: tmdb,
            media_type: mediaType,
            provider: 'cloudnestra',
            source: embedUrl
        });
    } catch (error) {
        console.error('[extract] error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to resolve stream URL',
            details: error?.message || String(error)
        });
    }
}
