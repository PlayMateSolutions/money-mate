import { Component, OnInit } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonMenuButton,
  IonFab,
  IonFabButton,
  IonIcon,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add } from 'ionicons/icons';
import { DatabaseService } from '../core/database/database.service';
import { TransactionFormModalComponent } from '../transactions';

@Component({
  selector: 'app-dashboard',
  templateUrl: 'dashboard.page.html',
  styleUrls: ['dashboard.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonMenuButton, IonFab, IonFabButton, IonIcon],
})
export class DashboardPage implements OnInit {
  constructor(
    private db: DatabaseService,
    private modalController: ModalController
  ) {
    addIcons({ add });
  }

  ngOnInit() {
    console.log('Dashboard initialized with database service');
  }

  async openTransactionModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: TransactionFormModalComponent
    });
    await modal.present();
  }
}
