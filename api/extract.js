export default async function handler(req, res) {
    // CORS headers
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
        
        // --- DYNAMIC URL CONSTRUCTION ---
        // You requested to play directly from Cloudnestra using the TMDB ID.
        // If your URL structure is cloudorchestranova.com/rcp/[TOKEN], 
        // you MUST replace the token with the TMDB ID or logic here.
        
        const baseUrl = "https://cloudorchestranova.com/rcp/";
        
        // If the ID is the token, we just append it. 
        // If the URL requires a specific format, modify the string below.
        const streamUrl = `${baseUrl}${tmdb}`; 

        return res.status(200).json({
            success: true,
            url: streamUrl,
            provider: 'cloudnestra'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            error: 'Failed to resolve stream URL'
        });
    }
}
