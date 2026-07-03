async function loadLicensedFrame() {
    if (!tmdbId) return dismissOverlay();
    const frame = document.getElementById('stream-frame');
    const notice = document.getElementById('streamNotice');
    if (!frame) return dismissOverlay();

    try {
        // Step 1: Build the vsembed URL dynamically
        const embedUrl = `https://vsembed.ru/embed/${mediaType}/${tmdbId}/`;
        
        // Step 2: Fetch the embed page to extract the Cloudnestra URL
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
            throw new Error(`Failed to fetch embed: ${response.status}`);
        }

        const html = await response.text();
        
        // Step 3: Extract the Cloudnestra URL from the HTML
        let cloudnestraUrl = null;
        
        // Look for Cloudnestra RCP URL in the HTML
        const cloudnestraMatch = html.match(/https?:\/\/[^\s"']*cloudorchestranova\.com\/rcp\/[^\s"']*/i);
        if (cloudnestraMatch) {
            cloudnestraUrl = cloudnestraMatch[0];
        }
        
        // If not found, look for any RCP URL
        if (!cloudnestraUrl) {
            const rcpMatch = html.match(/https?:\/\/[^\s"']*\/rcp\/[^\s"']*/i);
            if (rcpMatch) {
                cloudnestraUrl = rcpMatch[0];
            }
        }
        
        // If still not found, look for iframe sources
        if (!cloudnestraUrl) {
            const iframeMatch = html.match(/<iframe[^>]*src=["']([^"']*cloudorchestranova[^"']*)["'][^>]*>/i);
            if (iframeMatch) {
                cloudnestraUrl = iframeMatch[1];
            }
        }
        
        // If still not found, look for any iframe with rcp
        if (!cloudnestraUrl) {
            const iframeMatch = html.match(/<iframe[^>]*src=["']([^"']*\/rcp\/[^"']*)["'][^>]*>/i);
            if (iframeMatch) {
                cloudnestraUrl = iframeMatch[1];
            }
        }

        if (cloudnestraUrl) {
            console.log('Extracted Cloudnestra URL:', cloudnestraUrl);
            frame.src = cloudnestraUrl;
            frame.style.display = 'block';
            if (notice) {
                notice.style.display = 'none';
            }
        } else {
            throw new Error('No Cloudnestra URL found in embed page');
        }
        
    } catch (err) {
        console.error("Stream resolution failed:", err);
        frame.style.display = 'none';
        if (notice) {
            notice.style.display = 'block';
            notice.innerText = "Stream unavailable. Please try again later.";
        }
    } finally {
        dismissOverlay();
    }
}
