package com.seangritthy.movies;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.content.Intent;
import android.net.Uri;
import java.util.HashMap;
import java.util.Map;

public class VidSrcExtractor {
    private Activity activity;
    private WebView mainWebView;

    public VidSrcExtractor(Activity activity, WebView mainWebView) {
        this.activity = activity;
        this.mainWebView = mainWebView;
    }

    @JavascriptInterface
    public void openDownloadIntent(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(url), "video/*");
            
            // Add Referer for vsembed or cloudorchestra streams so download managers like 1DM can access them
            android.os.Bundle headers = new android.os.Bundle();
            headers.putString("Referer", "https://vsembed.ru/");
            intent.putExtra(android.provider.Browser.EXTRA_HEADERS, headers);
            
            activity.startActivity(Intent.createChooser(intent, "Download Video with..."));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public void extractVideoUrl(final String embedUrl, final String callbackName) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                final WebView hiddenWebView = new WebView(activity);
                
                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(hiddenWebView, true);

                WebSettings settings = hiddenWebView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setLoadsImagesAutomatically(true);
                settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36");
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

                final boolean[] isResolved = {false};
                final Handler handler = new Handler(Looper.getMainLooper());

                // Timeout fallback after 35s
                final Runnable timeoutRunnable = new Runnable() {
                    @Override
                    public void run() {
                        if (!isResolved[0]) {
                            isResolved[0] = true;
                            sendResult(null, callbackName);
                            hiddenWebView.stopLoading();
                            hiddenWebView.destroy();
                        }
                    }
                };
                handler.postDelayed(timeoutRunnable, 35000);

                hiddenWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        if (isResolved[0]) return null;

                        String url = request.getUrl().toString();
                        String lowUrl = url.toLowerCase();

                        // Block known ads (simplified ad blocker)
                        if (lowUrl.contains("ads") || lowUrl.contains("tracker") || lowUrl.contains("analytics")) {
                            return new WebResourceResponse("text/plain", "UTF-8", null);
                        }

                        if (lowUrl.contains("cloudnestra.com/rcp/") || lowUrl.contains("cloudorchestranova.com/rcp/")) {
                            if (!isResolved[0]) {
                                isResolved[0] = true;
                                handler.removeCallbacks(timeoutRunnable);
                                sendResult(url, callbackName);
                                activity.runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        hiddenWebView.stopLoading();
                                        hiddenWebView.destroy();
                                    }
                                });
                            }
                            return null;
                        }

                        if ((lowUrl.contains(".m3u8") || lowUrl.contains(".mp4") || lowUrl.contains("/playlist") || lowUrl.contains("/manifest")) &&
                            !lowUrl.contains("telemetry") && !lowUrl.contains("segment") && !lowUrl.contains(".ts")) {
                            if (!isResolved[0]) {
                                isResolved[0] = true;
                                handler.removeCallbacks(timeoutRunnable);
                                sendResult(url, callbackName);
                                activity.runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        hiddenWebView.stopLoading();
                                        hiddenWebView.destroy();
                                    }
                                });
                            }
                        }

                        return super.shouldInterceptRequest(view, request);
                    }

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        CookieManager.getInstance().flush();
                        String js = "(function() {" +
                                "try {" +
                                "    Object.defineProperty(navigator, 'webdriver', { get: () => false });" +
                                "    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });" +
                                "    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });" +
                                "    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });" +
                                "    Object.defineProperty(navigator, 'plugins', {" +
                                "        get: () => [" +
                                "            { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' }," +
                                "            { name: 'Chrome PDF Plugin', filename: 'chrome-pdf-plugin' }" +
                                "        ]" +
                                "    });" +
                                "} catch(e) {}" +
                                "function autoAction() {" +
                                "    var adSelectors = ['.ad', '.ads', '.modal', '.popup', '.overlay', '[id*=\"google_ads\"]'];" +
                                "    adSelectors.forEach(function(sel) {" +
                                "        document.querySelectorAll(sel).forEach(function(el) { el.remove(); });" +
                                "    });" +
                                "    var playButtons = ['.vjs-big-play-button', '.jw-display-icon-container', '.play-button', '#play-button', 'button[class*=\"play\"]', '.vjs-poster'];" +
                                "    playButtons.forEach(function(s) {" +
                                "        document.querySelectorAll(s).forEach(function(btn) { " +
                                "            try { " +
                                "                var clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });" +
                                "                btn.dispatchEvent(clickEvent);" +
                                "            } catch(e) {} " +
                                "        });" +
                                "    });" +
                                "    document.querySelectorAll('video').forEach(function(v) {" +
                                "        v.muted = false;" +
                                "        v.play().catch(function(e) {});" +
                                "    });" +
                                "}" +
                                "autoAction();" +
                                "var intervalId = setInterval(autoAction, 1500);" +
                                "setTimeout(function() { clearInterval(intervalId); }, 25000);" +
                                "var iframes = document.querySelectorAll('iframe');" +
                                "for (var i = 0; i < iframes.length; i++) {" +
                                "    try {" +
                                "        var src = iframes[i].src;" +
                                "        if (src.includes('cloudnestra') || src.includes('playm4u') || src.includes('vidplay') || src.includes('filemoon')) {" +
                                "            if (!window.hasRedirectedToSource) {" +
                                "                window.hasRedirectedToSource = true;" +
                                "                window.location.href = src;" +
                                "            }" +
                                "        }" +
                                "    } catch(e) {}" +
                                "}" +
                                "})();";
                        view.evaluateJavascript(js, null);
                    }
                });

                Map<String, String> headers = new HashMap<>();
                headers.put("Referer", "https://vsembed.ru/");
                headers.put("Origin", "https://vsembed.ru/");
                headers.put("Sec-Ch-Ua", "\"Chromium\";v=\"134\", \"Not:A-Brand\";v=\"24\", \"Google Chrome\";v=\"134\"");
                headers.put("Sec-Ch-Ua-Mobile", "?0");
                headers.put("Sec-Ch-Ua-Platform", "\"Windows\"");
                headers.put("Sec-Fetch-Dest", "document");
                headers.put("Sec-Fetch-Mode", "navigate");
                headers.put("Sec-Fetch-Site", "none");
                headers.put("Upgrade-Insecure-Requests", "1");

                hiddenWebView.loadUrl(embedUrl, headers);
            }
        });
    }

    private void sendResult(final String resultUrl, final String callbackName) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                String jsArg = resultUrl == null ? "null" : "'" + resultUrl.replace("'", "\\'") + "'";
                mainWebView.evaluateJavascript("javascript:window['" + callbackName + "'](" + jsArg + ");", null);
            }
        });
    }
}
