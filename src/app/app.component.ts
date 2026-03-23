import { Component } from '@angular/core';
import { 
  IonApp, 
  IonRouterOutlet
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  statsChart, 
  list, 
  settings, 
  card, 
  menu 
} from 'ionicons/icons';
import { MenuComponent } from './core/components';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [
    IonApp, 
    IonRouterOutlet,
    MenuComponent
  ],
})
export class AppComponent {
  constructor() {
    addIcons({ statsChart, list, settings, card, menu });
  }
}
