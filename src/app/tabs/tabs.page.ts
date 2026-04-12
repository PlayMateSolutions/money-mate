import { Component, EnvironmentInjector, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonFab, IonFabButton, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { statsChart, list, add } from 'ionicons/icons';
import { TransactionFormModalComponent } from '../transactions';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonFab, IonFabButton],
})
export class TabsPage {
  public environmentInjector = inject(EnvironmentInjector);

  constructor(private modalController: ModalController) {
    addIcons({ statsChart, list, add });
  }

  async openTransactionModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: TransactionFormModalComponent
    });
    await modal.present();
  }
}
