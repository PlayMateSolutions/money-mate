import { Component, EnvironmentInjector, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonFab, IonFabButton } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { statsChart, list, add } from 'ionicons/icons';


@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonFab, IonFabButton],
})
export class TabsPage {
  public environmentInjector = inject(EnvironmentInjector);

  constructor(private router: Router) {
    addIcons({ statsChart, list, add });
  }

  navigateToTransactionForm() {
    this.router.navigate(['/tabs/transactions/form']);
  }
}
