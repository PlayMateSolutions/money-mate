import { addIcons } from 'ionicons';
import { chevronForwardOutline, mailOutline } from 'ionicons/icons';
import { ChangeDetectionStrategy, Component, inject, ChangeDetectorRef } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Browser } from '@capacitor/browser';

import { App } from '@capacitor/app';
import { OnInit } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutPage implements OnInit {
  readonly email = 'ramaraj.tt+moneymate@gmail.com';
  readonly privacyUrl = 'https://jsramraj.github.io/apps/moneymate/privacy.html';
  readonly termsUrl = 'https://jsramraj.github.io/apps/moneymate/terms.html';
  readonly faqUrl = 'https://jsramraj.github.io/apps/moneymate/faq.html';

  version = '';
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    addIcons({ chevronForwardOutline, mailOutline });
    this.loadVersion();
  }

  async loadVersion() {
    try {
      const info = await App.getInfo();
      this.version = info.version;
    } catch (err) {
      this.version = '1.0.1';
    }
    this.cdr.markForCheck();
  }

  async openExternal(url: string) {
    await Browser.open({ url });
  }
}
