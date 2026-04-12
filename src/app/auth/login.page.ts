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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoGoogle, phonePortraitOutline } from 'ionicons/icons';
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

  constructor(
    private readonly sessionService: SessionService,
    private readonly router: Router,
    private readonly toastController: ToastController,
  ) {
    addIcons({ logoGoogle, phonePortraitOutline });
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
}