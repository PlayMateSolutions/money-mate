import { Component } from '@angular/core';
import { addIcons } from 'ionicons';
import { CommonModule } from '@angular/common';
import { downloadOutline } from 'ionicons/icons';
import { RouterLink } from '@angular/router';
import { 
  IonMenu, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonList, 
  IonItem, 
  IonIcon, 
  IonLabel, 
  IonFooter
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  imports: [
    CommonModule,
    IonMenu, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    IonList, 
    IonItem, 
    IonIcon, 
    IonLabel,
    IonFooter,
    RouterLink
  ],
  standalone: true
})
export class MenuComponent {
  showInstall = false;
  deferredPrompt: any = null;

  constructor() {
    // Register the download-outline icon for IonIcon usage
    addIcons({ 'download-outline': downloadOutline });

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstall = true;
    });
  }

  closeMenu(menu: any) {
    menu.close();
  }

  async promptInstall() {
    if (!this.deferredPrompt) return;

    this.deferredPrompt.prompt();
    const choiceResult = await this.deferredPrompt.userChoice;
    console.log('User choice:', choiceResult.outcome);
    this.deferredPrompt = null; // Reset
    this.showInstall = false;
  }
}