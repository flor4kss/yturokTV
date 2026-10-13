package ru.yturok.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.media.AudioManager;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.graphics.Color;

public class MainActivity extends Activity {
  private static final String SITE = "https://flor4kss.github.io/yturokTV/?tv=1";
  private WebView web;
  private FrameLayout root;
  private View customVideo;
  private WebChromeClient.CustomViewCallback customCallback;
  private View errorPage;
  private AudioManager audio;
  private final AudioManager.OnAudioFocusChangeListener audioListener = change -> {
    if(web == null) return;
    if(change == AudioManager.AUDIOFOCUS_GAIN) web.evaluateJavascript("window.yturokRemote?.resume()", null);
    else if(change < 0) web.evaluateJavascript("window.yturokRemote?.suspend()", null);
  };

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    immersive();
    root = new FrameLayout(this);
    root.setBackgroundColor(Color.BLACK);
    setContentView(root);
    audio = (AudioManager)getSystemService(AUDIO_SERVICE);
    web = new WebView(this);
    root.addView(web,new FrameLayout.LayoutParams(-1,-1));
    web.setBackgroundColor(Color.BLACK);
    web.setFocusable(true); web.setFocusableInTouchMode(true);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setAllowFileAccess(false); settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setUserAgentString(settings.getUserAgentString()+" yturokTV/1.0 GoogleTV");
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){
        return request.isForMainFrame() && !"flor4kss.github.io".equals(request.getUrl().getHost());
      }
      @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
        if(request.isForMainFrame()) showConnectionError();
      }
      @Override public void onPageFinished(WebView view,String url){web.requestFocus();}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public void onShowCustomView(View view,CustomViewCallback callback){
        if(customVideo!=null){callback.onCustomViewHidden();return;}
        customVideo=view;customCallback=callback;root.addView(view,new FrameLayout.LayoutParams(-1,-1));immersive();
      }
      @Override public void onHideCustomView(){hideCustomView();}
    });
    web.loadUrl(SITE);web.requestFocus();
  }
  private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);}
  private void hideCustomView(){if(customVideo!=null){root.removeView(customVideo);customVideo=null;customCallback.onCustomViewHidden();customCallback=null;}}
  private void showConnectionError(){
    if(errorPage!=null)return;
    LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setGravity(android.view.Gravity.CENTER);box.setPadding(50,50,50,50);box.setBackgroundColor(Color.rgb(23,19,30));
    TextView title=new TextView(this);title.setText("Не удалось подключиться к эфиру\nПроверь интернет на телевизоре");title.setTextColor(Color.WHITE);title.setTextSize(25);title.setGravity(android.view.Gravity.CENTER);box.addView(title);
    Button retry=new Button(this);retry.setText("Повторить подключение");retry.setOnClickListener(v->{root.removeView(errorPage);errorPage=null;web.loadUrl(SITE);web.requestFocus();});box.addView(retry);
    errorPage=box;root.addView(box,new FrameLayout.LayoutParams(-1,-1));retry.requestFocus();
  }
  private String remoteKey(int code){
    switch(code){
      case KeyEvent.KEYCODE_DPAD_UP:return "ArrowUp";
      case KeyEvent.KEYCODE_DPAD_DOWN:return "ArrowDown";
      case KeyEvent.KEYCODE_DPAD_LEFT:return "ArrowLeft";
      case KeyEvent.KEYCODE_DPAD_RIGHT:return "ArrowRight";
      case KeyEvent.KEYCODE_DPAD_CENTER:case KeyEvent.KEYCODE_ENTER:return "Enter";
      case KeyEvent.KEYCODE_BACK:return "Back";
      case KeyEvent.KEYCODE_MEDIA_PLAY:case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:return "Play";
      case KeyEvent.KEYCODE_CHANNEL_UP:return "ChannelUp";
      case KeyEvent.KEYCODE_CHANNEL_DOWN:return "ChannelDown";
      default:return null;
    }
  }
  @Override public boolean dispatchKeyEvent(KeyEvent event){
    if(errorPage!=null)return super.dispatchKeyEvent(event);
    String key=remoteKey(event.getKeyCode());
    if(key==null)return super.dispatchKeyEvent(event);
    if(event.getAction()==KeyEvent.ACTION_DOWN){
      if("Back".equals(key)&&customVideo!=null){hideCustomView();return true;}
      web.evaluateJavascript("window.yturokRemote ? window.yturokRemote.key('"+key+"') : false",result->{
        if("Back".equals(key)&&!"true".equals(result))new AlertDialog.Builder(this).setTitle("Выйти из yturokTV?").setNegativeButton("Продолжить просмотр",(d,w)->web.requestFocus()).setPositiveButton("Выйти",(d,w)->finish()).show();
      });
    }
    return true;
  }
  @Override protected void onResume(){super.onResume();immersive();if(web!=null){web.resumeTimers();web.onResume();web.evaluateJavascript("window.yturokRemote?.resume()",null);}if(audio!=null)audio.requestAudioFocus(audioListener,AudioManager.STREAM_MUSIC,AudioManager.AUDIOFOCUS_GAIN);}
  @Override protected void onPause(){if(web!=null){web.evaluateJavascript("window.yturokRemote?.suspend()",result->{if(web!=null){web.onPause();web.pauseTimers();}});}if(audio!=null)audio.abandonAudioFocus(audioListener);super.onPause();}
  @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();web=null;}super.onDestroy();}
}
