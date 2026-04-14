import { Component } from '@angular/core';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-recent-transactions-widget',
  standalone: true,
  imports: [IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Recent Transactions</ion-card-title>
        <ion-card-subtitle>Latest 5 to 10 transactions</ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        Recent Transactions widget content coming soon.
      </ion-card-content>
    </ion-card>
  `
})
export class RecentTransactionsWidgetComponent {}
