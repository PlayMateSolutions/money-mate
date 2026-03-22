import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonMenuButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-transactions',
  templateUrl: 'transactions.page.html',
  styleUrls: ['transactions.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonMenuButton]
})
export class TransactionsPage {

  constructor() {}

}
