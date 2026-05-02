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
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#121212', // Match your theme or brand color
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    }
  }
};

export default config;
