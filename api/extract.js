export default async function handler(req, res) {
    // 1. CORS Headers to allow frontend communication
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { tmdb } = req.query;

    if (!tmdb) {
        return res.status(400).json({ error: 'TMDB ID is required' });
    }

    try {
        const targetUrl = `https://vidsrc.xyz/embed/movie/${tmdb}`;
        
        // 2. Fetch HTML from VidSrc with spoofed user-agent parameters
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Referer': 'https://vidsrc.xyz/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        const html = await response.text();

        // 3. Extract the Cloudnestra iframe URL using Regex
        const iframeRegex = /iframe[^>]+src=["']([^"']*cloudnestra[^"']*)["']/i;
        const match = html.match(iframeRegex);

        let finalUrl = null;
        if (match && match[1]) {
            finalUrl = match[1].startsWith('http') ? match[1] : `https:${match[1]}`;
        }

        // 4. Return extracted link context
        if (finalUrl) {
            return res.status(200).json({ success: true, url: finalUrl });
        } else {
            return res.status(200).json({ success: false, url: `https://vidsrc.to/embed/movie/${tmdb}` });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to extract stream' });
    }
}
