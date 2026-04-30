import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moneymate.app',
  appName: 'MoneyMate',
  webDir: 'www',
  plugins: {
    SocialLogin: {
      google: {
        androidClientId: "1031239235658-a21arqinflilmv504uqdge4pv2debf27.apps.googleusercontent.com"
      }
    }
  }
};

export default config;
