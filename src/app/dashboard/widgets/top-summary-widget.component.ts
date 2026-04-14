import { Component } from '@angular/core';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-top-summary-widget',
  standalone: true,
  imports: [IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Top Summary</ion-card-title>
        <ion-card-subtitle>Total balance and current month expenses</ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        Top Summary widget content coming soon.
      </ion-card-content>
    </ion-card>
  `
})
export class TopSummaryWidgetComponent {}
