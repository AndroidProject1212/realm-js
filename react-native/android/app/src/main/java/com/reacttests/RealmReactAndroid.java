package com.reacttests;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.getkeepsafe.relinker.ReLinker;
import java.util.Map;
import java.util.HashMap;
import android.widget.Toast;
import com.facebook.react.bridge.Callback;
import android.util.Log;
import java.io.IOException;

public class RealmReactAndroid extends ReactContextBaseJavaModule {
	private static final String DURATION_SHORT_KEY = "SHORT";
    private static final String DURATION_LONG_KEY = "LONG";
    private String filesDirPath;

	public RealmReactAndroid(ReactApplicationContext reactContext) {
		super(reactContext);
        try {
            filesDirPath = getReactApplicationContext().getFilesDir().getCanonicalPath();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
		ReLinker.loadLibrary(reactContext, "realmreact");
    }

    @Override
    public void initialize() {
        Log.w("RealmReactAndroid", injectRealmJsContext(filesDirPath));
    }

    @Override
    public String getName() {
        return "RealmReactAndroid";
    }

    @ReactMethod
    public void resultOfJsContextInjection(Callback successCallback) {
        // Inject our JS Context
        Exception exception = new Exception();
        exception.fillInStackTrace();
        exception.printStackTrace();

        successCallback.invoke(injectRealmJsContext(filesDirPath));
    }

    @ReactMethod
    public void show(String message, int duration) {
        Toast.makeText(getReactApplicationContext(), message, duration).show();
    }

    // fileDir: path of the internal storage of the application
	private native String injectRealmJsContext(String fileDir);
}
