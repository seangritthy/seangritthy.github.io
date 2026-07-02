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

            let token = '';
            const tokenEndpoint = process.env.CLOUDNESTRA_TOKEN_ENDPOINT;
            const tokenHeaderName = process.env.CLOUDNESTRA_TOKEN_HEADER || 'Authorization';
            const tokenHeaderValue = process.env.CLOUDNESTRA_TOKEN_VALUE || '';
            const tokenMethod = (process.env.CLOUDNESTRA_TOKEN_METHOD || 'GET').toUpperCase();

            if (tokenEndpoint) {
                const endpointUrl = new URL(tokenEndpoint);
                endpointUrl.searchParams.set('tmdb', tmdb);
                endpointUrl.searchParams.set('type', mediaType);

                const headers = { Accept: 'application/json' };
                if (tokenHeaderValue) {
                    headers[tokenHeaderName] = tokenHeaderValue;
                }

                const tokenResponse = await fetch(endpointUrl.toString(), {
                    method: tokenMethod === 'POST' ? 'POST' : 'GET',
                    headers,
                    body: tokenMethod === 'POST' ? JSON.stringify({ tmdb, type: mediaType }) : undefined
                });

                if (!tokenResponse.ok) {
                    return res.status(502).json({
                        success: false,
                        error: `Cloudnestra token endpoint failed (${tokenResponse.status})`,
                        code: 'CLOUDNESTRA_TOKEN_REQUEST_FAILED'
                    });
                }

                const tokenData = await tokenResponse.json();
                token = tokenData?.token || tokenData?.id || tokenData?.data?.token || tokenData?.data?.id || '';
                if (!token) {
                    return res.status(502).json({
                        success: false,
                        error: 'Cloudnestra token response missing token field',
                        code: 'CLOUDNESTRA_TOKEN_MISSING'
                    });
                }
            }

            const template = process.env.CLOUDNESTRA_PATH_TEMPLATE || '/embed/{type}/{tmdb}';
            const resolvedPath = template
                .replaceAll('{type}', encodeURIComponent(mediaType))
                .replaceAll('{tmdb}', encodeURIComponent(tmdb))
                .replaceAll('{token}', encodeURIComponent(token));

            if (resolvedPath.includes('{token}')) {
                return res.status(503).json({
                    success: false,
                    error: 'Cloudnestra template requires {token}, but token is not configured',
                    code: 'MISSING_CLOUDNESTRA_TOKEN_SETUP'
                });
            }

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
