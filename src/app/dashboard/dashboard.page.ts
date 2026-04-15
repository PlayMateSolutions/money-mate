import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonMenuButton,
  IonButtons,
  IonButton,
  IonIcon,
  IonText
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { settingsOutline } from 'ionicons/icons';
import { DashboardLayoutService } from './dashboard-layout.service';
import {
  DASHBOARD_WIDGET_BY_ID,
  DashboardWidgetDefinition,
  DashboardWidgetId
} from './dashboard-widget-registry';

@Component({
  selector: 'app-dashboard',
  templateUrl: 'dashboard.page.html',
  styleUrls: ['dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonMenuButton,
    IonButtons,
    IonButton,
    IonIcon,
    IonText
  ],
})
export class DashboardPage implements OnInit, OnDestroy {
  visibleWidgets: DashboardWidgetDefinition[] = [];
  private readonly layoutService = inject(DashboardLayoutService);
  private readonly router = inject(Router);
  private routerSubscription?: Subscription;

  constructor() {
    addIcons({ settingsOutline });
  }

  ngOnInit(): void {
    this.refreshVisibleWidgets();

    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && this.router.url.startsWith('/tabs/dashboard')) {
        this.refreshVisibleWidgets();
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.refreshVisibleWidgets();
  }

  trackByWidgetId(_: number, widget: DashboardWidgetDefinition): DashboardWidgetId {
    return widget.id;
  }

  async openCustomizeDashboard(): Promise<void> {
    await this.router.navigate(['/dashboard/customize']);
  }

  private refreshVisibleWidgets(): void {
    const widgetOrder = this.layoutService
      .getLayout()
      .filter((item) => item.visible)
      .sort((a, b) => a.order - b.order)
      .map((item) => item.id);

    this.visibleWidgets = widgetOrder
      .map((id) => this.findDefinition(id))
      .filter((widget): widget is DashboardWidgetDefinition => !!widget);
  }

  private findDefinition(widgetId: DashboardWidgetId): DashboardWidgetDefinition | undefined {
    return DASHBOARD_WIDGET_BY_ID.get(widgetId);
  }
}
