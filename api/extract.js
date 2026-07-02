export default async function handler(req, res) {
    // CORS headers for frontend calls
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { tmdb, type } = req.query;

    if (!tmdb) {
        return res.status(400).json({ error: 'TMDB ID is required' });
    }

    try {
        const mediaType = type === 'tv' ? 'tv' : 'movie';
        const provider = (process.env.STREAM_PROVIDER || 'licensed').toLowerCase();

        if (provider === 'cloudnestra') {
            const cloudOrigin = process.env.CLOUDNESTRA_ORIGIN || process.env.LICENSED_STREAM_ORIGIN;
            if (!cloudOrigin) {
                return res.status(503).json({
                    success: false,
                    error: 'Cloudnestra provider is not configured',
                    code: 'MISSING_CLOUDNESTRA_ORIGIN'
                });
            }

            const template = process.env.CLOUDNESTRA_PATH_TEMPLATE || '/embed/{type}/{tmdb}';
            const resolvedPath = template
                .replaceAll('{type}', encodeURIComponent(mediaType))
                .replaceAll('{tmdb}', encodeURIComponent(tmdb));

            const normalizedOrigin = cloudOrigin.replace(/\/$/, '');
            const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
            const streamUrl = `${normalizedOrigin}${normalizedPath}`;

            return res.status(200).json({
                success: true,
                url: streamUrl,
                provider: 'cloudnestra'
            });
        }

        const streamOrigin = process.env.LICENSED_STREAM_ORIGIN;
        if (!streamOrigin) {
            return res.status(503).json({
                success: false,
                error: 'Licensed stream provider is not configured',
                code: 'MISSING_LICENSED_STREAM_ORIGIN'
            });
        }

        const origin = streamOrigin.replace(/\/$/, '');
        const streamUrl = `${origin}/play?tmdb=${encodeURIComponent(tmdb)}&type=${encodeURIComponent(mediaType)}`;

        return res.status(200).json({
            success: true,
            url: streamUrl,
            provider: 'licensed'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            error: 'Failed to resolve licensed stream URL'
        });
    }
}
