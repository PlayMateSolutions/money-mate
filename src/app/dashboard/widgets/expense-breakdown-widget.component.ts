import { Component } from '@angular/core';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-expense-breakdown-widget',
  standalone: true,
  imports: [IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Expense Breakdown</ion-card-title>
        <ion-card-subtitle>Category-wise expense overview</ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        Expense Breakdown widget content coming soon.
      </ion-card-content>
    </ion-card>
  `
})
export class ExpenseBreakdownWidgetComponent {}
