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
        
        // The Base64 encoded string containing the target URL structure
        const ENCODED_BASE = "YjY0ZjFkNGRmZjg4ODU5NmYzZTJkODllZTg5MmNmOTg6TlVJeVJsSXpTSGsxTlhBeU4zWmhlWGRSVUZvNGIxUk5URU5PZEhaYVYyWmlXVFZ3YVZZdmIyRlpOV1Z2ZVZjeE1VdGhPWEI1ZUhwYVJuVTVjMGxCY0c5WlVtbzJNMFJsV1UxRWN6TndhWFZCV25kd1UyMXdWRmh1Vm5sRmVrcHNORkEyUkd0V2FtaGtlbkpOSzJocGExVndZekZOZFRKTFdrZDJiVGhXZFU4elYzSTNURzU2YjNoT0wxaHRhMWRGUTFWaGJXSlBRU3RwVTJsQlRVZHFOR3B1WXpoWFIwdDJRVWxoTjNCdlRFeG9kbk5hTWxwS1duVk1lUzk2VjJFdmJIRnVjRlo2VlNzelMzQlBkelJvUldsc2NrUmhiVmgxYlRSaVRXZHRVbFp6TXpJclZ6RTRRM2haYW5aYVpuUTBiRkY2UzFOSVIybFRka3QwZUM5MFFXeHRXbVZXU21ZeldWZHVTRmhFUlRjeVR6RlpXRmhGZW5WRFpFaHRWSGg2VGpoemNsUlRhM1pZU3pOUmJESjNUa1V4U21nMmFtbE5hMUpoVFd0VlNrOTRTVXR2T1VaSFNEWnBkVEJvYUdodmVHOTVabWRWUzBoelZXdzROM0pvUTJKVVZqSmpXV1JNTDBaVmFqUmxSV0pFTDNNMVltdzJjM3A0WVNzNU4wbFdiWGR3UkVKbllWb3dSMmRqUm5SSGF6TkNVVFpoYUdKb2RYY3JTWFZYUVhobVJISmtUM1pJYlZKMmRHdFhVa1pSTTNOelRDdDBRemh0TTBGTU9UUnNSbXhwVlRGbk9XcFdhRlJpU0dsM1Nub3ljM1pvYVVreGRreEJObTVNU0ZOYVZ6YzVZekpITVZsVlNETlVPSEY0V1ZOdGIwRldiVW8wZGt4d01DOHJSMmRVZG1vd1ZXeHFhVTVDZVdoNVlUYzBVRmRyVjBsYVdIZzRMMHB1UjNwQlRFUTFaMlpKUzNoUVJFd3hNVTV4TkVoUWFrZ3hUblI0UXpFcmFHWjBjamhYVUhoMGEyZG1ZbkJOY2xSc2NVeFBNMnBJYjJWeWJYbE9kazluTUZoR1pYUTFSWE5WVjNVeGNreERjbGRhWkVSaldFbEpiblowY3pWdmEwMU1NRmxaYlVGNFFsYzVhekpwTDFWeVNVSlVjRGR4VkcxUWJHa3JiMEZXVm5sd1FUVlJhV000TWtoTlRtaDRNV0ZpZHpSM1oyMHpZMHhuUlhWeFdYcGxORkppUm5OeVIzbExZMFo1ZEdKWWNXNHdkaTlvYWpkdU4yOXhaVmRYVURsYVNsQldlVXBzZDJaclQwUXllVzB6YVVSM01FSlpXWFZHWVRFMVNUQXJaWEZ3VkRnNFZVbEtSbXcyZUdVMGVFRXlTMFoyTWxCaVJGQlljbkZEYUZVcmNEVTVLMnRCWW10a1VDODNhVUZFU1ZkeGJuVnBTMVF5T1c4dllrSm9aelJ6WWxkUVUyVlBTRlJRVmtSRlEzSjFiM0p4UVZOT2VXaHFlV1F3U3pSdk1WVm1ORFpWTWpaYVkxQXdLMFV6VVcxMGVVazRTRUkwUjJkdVVVUnliVzUyVEhJNGMwNUxVR3RHU210elFXZzJUWElyTkcxUlEyTm1aM2RIYUhOUU9YY3JieTl6YW0xM1FUZHRkbkJVWjJJek5XSktRalZwTkRkTlpqSnBUblpVTDJOM1ltOUVkVkZKVEhGVE1HUkNTV1ZNU0d3d1V6VjZSVkpGVUhaak5FeDVXbmRHWldjd2VtdHdjblYzZFM5d1ZITnJRMG80Y0VObGIzSnhVa0ZMT0V3ck9GZEJkbEZZTVhGb2FsaDBkazlxWm1kWU1qRXhjV1J2VjJsdk9ESk5NbEl3TUhCbWRuZEVha2RRUVdkeE0wUk1hMlpXVkROR2JXWm9SaTlhY1doWmVHNXZiMUI1YkdsR1prZFBVSEJqTldoSGVtdDFVbXhSYjBOb1preHdZMUpXTm5CcFNqQmFZeXRtUmxkRE5ubDZLMGRNWkRJd2FHNVdZekl6VDBoWFRUbFZNRmQ1VDNaQ1JFa3dTVkpyZEhCamNFNVJRMWd3VW1sMVlsaFBSV1JYTm5OWVkyaHdOamxTWkVwSVVtYzBkR1ZzTlRCWWJreERkMDFQTUhSVmFteFBORm96Y21GS1JrOTZWVVIzU1dwelFWTlBMMFJqY0dOdlFXbExNbWRTYlVrMVVIRjVXVGMwTW1RMmMwUlZOWGM5";
        
        // Decode the string using Node.js Buffer
        const decodedUrl = Buffer.from(ENCODED_BASE, 'base64').toString('utf-8');

        // Dynamically replace the ID token in the URL with the TMDB ID requested
        const streamUrl = decodedUrl && decodedUrl.includes('rcp/') 
            ? decodedUrl.replace(/rcp\/[^/]+/, `rcp/${tmdb}`)
            : decodedUrl;

        return res.status(200).json({
            success: true,
            url: streamUrl,
            provider: 'decoded-link'
        });
    } catch (error) {
        console.error('Decoding failed:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to resolve stream URL'
        });
    }
}
