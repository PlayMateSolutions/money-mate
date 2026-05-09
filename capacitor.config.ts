import type { CapacitorConfig } from '@capacitor/cli';


const config: CapacitorConfig = {
  appId: 'com.ramaraj.moneymate',
  appName: 'MoneyMate',
  webDir: 'www',
  plugins: {
    SocialLogin: {
      google: {
        androidClientId: "102904530835-vrtlhimba7aqdaqcm56orbvj19n3ilhi.apps.googleusercontent.com"
      }
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#26A69A', // Match the gradient start color
      androidSplashResourceName: 'splash_screen',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    }
  }
};

export default config;
