package com.moneymate.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.capgo.capacitor_social_login.SocialLogin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register the SocialLogin plugin for OAuth scopes
        registerPlugin(SocialLogin.class);
    }
}
