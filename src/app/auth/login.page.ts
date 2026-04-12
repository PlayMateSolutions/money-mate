import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoGoogle, phonePortraitOutline, chevronDown, chevronUp, trash } from 'ionicons/icons';
import { SessionService } from '../core/services';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonText,
    IonSpinner,
  ],
})
export class LoginPage {
  errorMessage: string | null = null;
  isBusy = false;
  showTroubleshooting = false;

  constructor(
    private readonly sessionService: SessionService,
    private readonly router: Router,
    private readonly toastController: ToastController,
    private readonly alertController: AlertController,
  ) {
    addIcons({ logoGoogle, phonePortraitOutline, chevronDown, chevronUp, trash });
  }

  async continueWithGoogle(): Promise<void> {
    this.errorMessage = null;
    this.isBusy = true;

    const isSuccess = await this.sessionService.signInWithGoogle();
    this.isBusy = false;

    if (isSuccess) {
      await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
      return;
    }

    this.errorMessage = 'Google sign-in failed. You can retry or continue offline.';
    const toast = await this.toastController.create({
      message: 'Unable to sign in with Google',
      duration: 2500,
      color: 'danger',
      position: 'bottom',
    });
    await toast.present();
  }

  async continueOffline(): Promise<void> {
    this.sessionService.continueOffline();
    await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
  }

  toggleTroubleshooting(): void {
    this.showTroubleshooting = !this.showTroubleshooting;
  }

  async clearAppData(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Clear All Data?',
      message: 'This will delete all local app data. You will have to login again.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
        },
        {
          text: 'Clear All Data',
          role: 'destructive',
          handler: async () => {
            try {
              // Clear localStorage
              localStorage.clear();
              sessionStorage.clear();
              
              // Reload page
              const toast = await this.toastController.create({
                message: 'All data cleared. Refreshing...',
                duration: 2000,
                color: 'success',
                position: 'bottom',
              });
              await toast.present();
              
              setTimeout(() => {
                window.location.href = '/login';
              }, 1000);
            } catch (error) {
              console.error('Error clearing data:', error);
              const errorToast = await this.toastController.create({
                message: 'Error clearing data',
                duration: 2500,
                color: 'danger',
                position: 'bottom',
              });
              await errorToast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}