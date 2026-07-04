package com.seangritthy.movies;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private FrameLayout fullscreenContainer;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        fullscreenContainer = findViewById(R.id.fullscreen_container);

        // Configure WebView settings
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        
        // Allow mixed content for iframe video streams
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        
        // Setup secure WebViewAssetLoader
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                String host = request.getUrl().getHost();

                // MetaMask deep link domains must open externally so Android
                // resolves them to the MetaMask app (or Play Store).
                if (host != null && (host.equals("metamask.app.link") || host.endsWith(".metamask.io"))) {
                    try {
                        android.content.Intent intent = new android.content.Intent(
                            android.content.Intent.ACTION_VIEW, request.getUrl());
                        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception e) {
                        // If no handler, send to Play Store
                        startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,
                            android.net.Uri.parse("market://details?id=io.metamask")));
                    }
                    return true;
                }

                // Normal http/https URLs load inside WebView
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false;
                }

                // Custom schemes (metamask://, intent://, etc.)
                try {
                    android.content.Intent intent = android.content.Intent.parseUri(url, android.content.Intent.URI_INTENT_SCHEME);
                    if (intent.resolveActivity(getPackageManager()) != null) {
                        startActivity(intent);
                    } else {
                        String packageName = intent.getPackage();
                        if (packageName == null && url.startsWith("metamask://")) {
                            packageName = "io.metamask";
                        }
                        if (packageName != null) {
                            startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, 
                                android.net.Uri.parse("market://details?id=" + packageName)));
                        } else {
                            android.widget.Toast.makeText(MainActivity.this, "App not found for this action", android.widget.Toast.LENGTH_SHORT).show();
                        }
                    }
                    return true;
                } catch (Exception e) {
                    return true;
                }
            }
        });

        // Setup custom WebChromeClient for video fullscreen support
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    onHideCustomView();
                    return;
                }

                customView = view;
                customViewCallback = callback;

                // Hide WebView and show fullscreen container
                webView.setVisibility(View.GONE);
                fullscreenContainer.setVisibility(View.VISIBLE);
                fullscreenContainer.addView(customView, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));

                // Enter fullscreen mode in activity window
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            }

            @Override
            public void onHideCustomView() {
                if (customView == null) {
                    return;
                }

                // Show WebView and hide fullscreen container
                webView.setVisibility(View.VISIBLE);
                fullscreenContainer.setVisibility(View.GONE);
                fullscreenContainer.removeView(customView);

                customView = null;
                if (customViewCallback != null) {
                    customViewCallback.onCustomViewHidden();
                }

                // Exit fullscreen mode in activity window
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            }
        });

        webView.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_VIEW);
                i.setData(android.net.Uri.parse(url));
                startActivity(i);
            }
        });

        // Load the main index.html file through the secure appassets domain
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");

        // Handle initial deep link if any
        handleIntent(getIntent());

        // Handle back button presses using AndroidX back-press callback API
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (customView != null) {
                    // If video is in fullscreen, exit fullscreen first
                    onHideCustomView();
                } else if (webView.canGoBack()) {
                    // Otherwise navigate back in WebView history
                    webView.goBack();
                } else {
                    // Otherwise close the activity (exit app)
                    finish();
                }
            }
        });
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(android.content.Intent intent) {
        if (intent == null) return;
        android.net.Uri data = intent.getData();
        if (data != null && "githubmovies".equals(data.getScheme()) && "login".equals(data.getHost())) {
            String query = data.getQuery();
            if (query != null && !query.isEmpty()) {
                webView.loadUrl("https://appassets.androidplatform.net/assets/index.html?login_success=1&" + query);
            }
        }
    }

    private void onHideCustomView() {
        if (webView != null && webView.getWebChromeClient() != null) {
            webView.getWebChromeClient().onHideCustomView();
        }
    }
}
