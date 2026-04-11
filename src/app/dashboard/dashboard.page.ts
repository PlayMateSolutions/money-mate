import { Component, OnInit } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonMenuButton } from '@ionic/angular/standalone';
import { DatabaseService } from '../core/database/database.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: 'dashboard.page.html',
  styleUrls: ['dashboard.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonMenuButton],
})
export class DashboardPage implements OnInit {
  constructor(private db: DatabaseService) {
  }

  ngOnInit() {
    console.log('Dashboard initialized with database service');
  }
}
