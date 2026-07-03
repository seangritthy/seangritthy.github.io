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
        
        // Step 1: Build the embed URL dynamically based on TMDB ID
        // Using vidsrc format that works for ANY movie
        const embedUrl = `https://vidsrc.xyz/embed/${mediaType}/${tmdb}`;
        
        // Step 2: Fetch the embed page
        const response = await fetch(embedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Referer': 'https://vidsrc.xyz/',
                'Origin': 'https://vidsrc.xyz/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch embed: ${response.status}`);
        }

        const html = await response.text();

        // Step 3: Extract the actual video source URL from the HTML
        let videoUrl = null;

        // Method 1: Look for CloudNestra RCP URL in the HTML
        const cloudnestraMatch = html.match(/https?:\/\/[^\s"']*cloudnestra\.com\/rcp\/[^\s"']*/i);
        if (cloudnestraMatch) {
            videoUrl = cloudnestraMatch[0];
        }

        // Method 2: Look for .m3u8 playlist URLs
        if (!videoUrl) {
            const m3u8Match = html.match(/https?:\/\/[^\s"']*\.m3u8[^\s"']*/i);
            if (m3u8Match) {
                videoUrl = m3u8Match[0];
            }
        }

        // Method 3: Look for .mp4 direct URLs
        if (!videoUrl) {
            const mp4Match = html.match(/https?:\/\/[^\s"']*\.mp4[^\s"']*/i);
            if (mp4Match) {
                videoUrl = mp4Match[0];
            }
        }

        // Method 4: Look for iframe sources that might contain the video
        if (!videoUrl) {
            const iframeMatch = html.match(/<iframe[^>]*src=["']([^"']*)["'][^>]*>/i);
            if (iframeMatch) {
                const iframeSrc = iframeMatch[1];
                // If the iframe src looks like a video source, use it
                if (iframeSrc.includes('cloudnestra') || iframeSrc.includes('playm4u') || iframeSrc.includes('vidplay')) {
                    videoUrl = iframeSrc;
                }
            }
        }

        // Method 5: Extract from JavaScript variables
        if (!videoUrl) {
            const jsMatch = html.match(/video\s*:\s*["']([^"']*)["']/i);
            if (jsMatch) {
                videoUrl = jsMatch[1];
            }
        }

        // Method 6: Extract from JSON data attributes
        if (!videoUrl) {
            const jsonMatch = html.match(/data-src=["']([^"']*)["']/i);
            if (jsonMatch) {
                videoUrl = jsonMatch[1];
            }
        }

        if (!videoUrl) {
            throw new Error('No video source found in the embed page');
        }

        // Clean up the URL - remove any query parameters that might cause issues
        const cleanUrl = videoUrl.split('?')[0] || videoUrl;

        console.log(`Extracted video URL for TMDB ${tmdb}:`, cleanUrl);

        return res.status(200).json({
            success: true,
            url: cleanUrl,
            embed_url: embedUrl,
            tmdb_id: tmdb,
            media_type: mediaType,
            provider: 'vidsrc'
        });

    } catch (error) {
        console.error('Extraction failed:', error);
        
        // Fallback: Try alternative embed sources
        try {
            const fallbackEmbedUrl = `https://embed.su/embed/${mediaType}/${tmdb}`;
            const fallbackResponse = await fetch(fallbackEmbedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://embed.su/'
                }
            });
            
            if (fallbackResponse.ok) {
                const fallbackHtml = await fallbackResponse.text();
                const fallbackMatch = fallbackHtml.match(/https?:\/\/[^\s"']*\.(?:m3u8|mp4)[^\s"']*/i);
                if (fallbackMatch) {
                    return res.status(200).json({
                        success: true,
                        url: fallbackMatch[0],
                        embed_url: fallbackEmbedUrl,
                        tmdb_id: tmdb,
                        media_type: mediaType,
                        provider: 'embed.su'
                    });
                }
            }
        } catch (fallbackError) {
            console.error('Fallback failed:', fallbackError);
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to extract video URL',
            details: error.message
        });
    }
}
