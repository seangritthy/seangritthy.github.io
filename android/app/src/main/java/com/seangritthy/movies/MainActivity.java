package com.seangritthy.movies;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.IOException;
import java.net.URISyntaxException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import android.widget.Toast;
import android.app.DownloadManager;
import android.os.Environment;
import android.webkit.DownloadListener;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.database.Cursor;

public class MainActivity extends Activity {
    private WebView myWebView;
    private ValueCallback<Uri[]> mFilePathCallback;
    private Uri mCameraPhotoUri;
    private static final int INPUT_FILE_REQUEST_CODE = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        myWebView = new WebView(this);
        setContentView(myWebView);

        myWebView.getSettings().setJavaScriptEnabled(true);
        myWebView.getSettings().setDomStorageEnabled(true);
        myWebView.getSettings().setAllowFileAccess(true);

        myWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("file://")) {
                    return false;
                }
                if (url.endsWith(".apk") || url.contains("releases/download")) {
                    return false; // let WebView handle it -> triggers DownloadListener
                }
                
                try {
                    Intent intent;
                    if (url.startsWith("intent:")) {
                        intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                    } else {
                        intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    }
                    startActivity(intent);
                    return true;
                } catch (URISyntaxException | ActivityNotFoundException e) {
                    e.printStackTrace();
                    return true;
                }
            }
            
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file://")) {
                    return false;
                }
                if (url.endsWith(".apk") || url.contains("releases/download")) {
                    return false;
                }
                
                try {
                    Intent intent;
                    if (url.startsWith("intent:")) {
                        intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                    } else {
                        intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    }
                    startActivity(intent);
                    return true;
                } catch (URISyntaxException | ActivityNotFoundException e) {
                    e.printStackTrace();
                    return true;
                }
            }
        });

        // Register DownloadManager BroadcastReceiver to auto-install APK
        BroadcastReceiver onDownloadComplete = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != -1) {
                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    Uri downloadUri = dm.getUriForDownloadedFile(id);
                    if (downloadUri != null) {
                        try {
                            Intent installIntent = new Intent(Intent.ACTION_VIEW);
                            installIntent.setDataAndType(downloadUri, "application/vnd.android.package-archive");
                            installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            startActivity(installIntent);
                        } catch (ActivityNotFoundException e) {
                            Toast.makeText(context, "Cannot open file", Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            }
        };
        // Register receiver for Android 13+ and below
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        }

        myWebView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType);
                    String cookies = CookieManager.getInstance().getCookie(url);
                    request.addRequestHeader("cookie", cookies);
                    request.addRequestHeader("User-Agent", userAgent);
                    request.setDescription("Downloading file...");
                    request.setTitle(URLUtil.guessFileName(url, contentDisposition, mimeType));
                    request.allowScanningByMediaScanner();
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, contentDisposition, mimeType));
                    
                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    dm.enqueue(request);
                    Toast.makeText(getApplicationContext(), "Downloading File", Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    Toast.makeText(getApplicationContext(), "Download failed", Toast.LENGTH_LONG).show();
                }
            }
        });
        
        myWebView.setWebChromeClient(new WebChromeClient() {
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (mFilePathCallback != null) {
                    mFilePathCallback.onReceiveValue(null);
                }
                mFilePathCallback = filePathCallback;

                Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                if (takePictureIntent.resolveActivity(getPackageManager()) != null) {
                    File photoFile = null;
                    try {
                        photoFile = createImageFile();
                    } catch (IOException ex) {
                        // Error
                    }

                    if (photoFile != null) {
                        mCameraPhotoUri = FileProvider.getUriForFile(MainActivity.this,
                                getPackageName() + ".fileprovider",
                                photoFile);
                        takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, mCameraPhotoUri);
                    } else {
                        takePictureIntent = null;
                    }
                }

                Intent contentSelectionIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentSelectionIntent.setType("image/*");

                Intent[] intentArray;
                if (takePictureIntent != null) {
                    intentArray = new Intent[]{takePictureIntent};
                } else {
                    intentArray = new Intent[0];
                }

                Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
                chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
                chooserIntent.putExtra(Intent.EXTRA_TITLE, "Image Chooser");
                chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray);

                startActivityForResult(chooserIntent, INPUT_FILE_REQUEST_CODE);

                return true;
            }
        });

        myWebView.loadUrl("file:///android_asset/index.html");
    }

    private File createImageFile() throws IOException {
        String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
        String imageFileName = "JPEG_" + timeStamp + "_";
        File storageDir = getExternalFilesDir(null);
        return File.createTempFile(imageFileName, ".jpg", storageDir);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != INPUT_FILE_REQUEST_CODE || mFilePathCallback == null) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }

        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK) {
            if (data == null || data.getData() == null) {
                if (mCameraPhotoUri != null) {
                    results = new Uri[]{mCameraPhotoUri};
                }
            } else {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                } else if (mCameraPhotoUri != null) {
                    results = new Uri[]{mCameraPhotoUri};
                }
            }
        }

        mFilePathCallback.onReceiveValue(results);
        mFilePathCallback = null;
    }
}



