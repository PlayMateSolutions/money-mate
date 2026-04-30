import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moneymate.app',
  appName: 'MoneyMate',
  webDir: 'www',
  plugins: {
    SocialLogin: {
      google: {
        androidClientId: "1031239235658-94pfpseiboals1kv4g0aehujusmlbcfb.apps.googleusercontent.com"
      }
    }
  }
};

export default config;
