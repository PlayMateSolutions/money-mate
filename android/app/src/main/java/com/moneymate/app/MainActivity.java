package com.moneymate.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register the SocialLogin plugin for OAuth scopes
        registerPlugin(SocialLoginPlugin.class);
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // This method indicates to the plugin that MainActivity has been properly configured
        // for OAuth scopes usage. Required by @capgo/capacitor-social-login plugin.
    }
}
