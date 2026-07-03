// /api/extract.js
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { tmdb, type } = req.query;

    if (!tmdb) {
        return res.status(400).json({ error: 'TMDB ID is required' });
    }

    try {
        const mediaType = type === 'tv' ? 'tv' : 'movie';

        // Providers to try
        const embedSources = [
            `https://vsembed.ru/embed/${mediaType}/${tmdb}/`,
            `https://vidsrc.xyz/embed/${mediaType}/${tmdb}`,
            `https://embed.su/embed/${mediaType}/${tmdb}`
        ];

        let cloudnestraUrl = null;
        let lastError = null;

        for (const embedUrl of embedSources) {
            try {
                console.log(`[extract] Trying: ${embedUrl}`);
                const response = await fetch(embedUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                        'Referer': 'https://vsembed.ru/',
                        'Origin': 'https://vsembed.ru/',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });

                if (!response.ok) {
                    console.log(`[extract] Failed (${response.status}): ${embedUrl}`);
                    continue;
                }

                const html = await response.text();

                // Extraction patterns
                const patterns = [
                    /https?:\/\/[^\s"']*cloudorchestranova\.com\/rcp\/[a-zA-Z0-9]+/i,
                    /https?:\/\/[^\s"']*\/rcp\/[a-zA-Z0-9]+/i,
                    /<iframe[^>]*src=["']([^"']*cloudorchestranova[^"']*)["'][^>]*>/i,
                    /<iframe[^>]*src=["']([^"']*\/rcp\/[^"']*)["'][^>]*>/i,
                    /"url":"([^"]*cloudorchestranova[^"]*)"/i,
                    /"file":"([^"]*cloudorchestranova[^"]*)"/i
                ];

                for (const pattern of patterns) {
                    const match = html.match(pattern);
                    if (match) {
                        cloudnestraUrl = match[1] || match[0];
                        cloudnestraUrl = cloudnestraUrl.split('"')[0].split("'")[0].split('&')[0];
                        console.log(`[extract] Found: ${cloudnestraUrl}`);
                        break;
                    }
                }

                if (cloudnestraUrl) break;
            } catch (err) {
                console.log(`[extract] Error with ${embedUrl}:`, err.message);
                lastError = err;
            }
        }

        if (cloudnestraUrl) {
            return res.status(200).json({
                success: true,
                url: cloudnestraUrl,
                tmdb_id: tmdb,
                media_type: mediaType,
                provider: 'dynamic-extract'
            });
        } else {
            return res.status(404).json({
                success: false,
                error: 'No stream URL found for this movie.',
                details: lastError ? lastError.message : 'Not found'
            });
        }

    } catch (error) {
        console.error('[extract] Fatal error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
}
