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
import { appsOutline } from 'ionicons/icons';
import { DashboardLayoutService } from './dashboard-layout.service';
import { DashboardDateRangeService, DashboardDateRange } from './services/dashboard-date-range.service';
import { AnalyticsService } from '../core/services';
import {
  DASHBOARD_WIDGET_BY_ID,
  DashboardWidgetDefinition,
  DashboardWidgetId
} from './dashboard-widget-registry';
import { DateRangeFilterComponent } from '../shared/date-range-filter/date-range-filter.component';

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
    IonText,
    DateRangeFilterComponent
  ],
})
export class DashboardPage implements OnInit, OnDestroy {
  visibleWidgets: DashboardWidgetDefinition[] = [];
  selectedDateRange: DashboardDateRange = {
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
    period: 'monthly',
  };
  private readonly layoutService = inject(DashboardLayoutService);
  private readonly router = inject(Router);
  private readonly dateRangeService = inject(DashboardDateRangeService);
  private readonly analyticsService = inject(AnalyticsService);
  private routerSubscription?: Subscription;

  constructor() {
    addIcons({ appsOutline });
  }

  ngOnInit(): void {
    this.refreshVisibleWidgets();
    // Set initial date range in the service
    this.dateRangeService.setDateRange(this.selectedDateRange);

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

  onDateRangeChange(range: DashboardDateRange) {
    this.selectedDateRange = range;
    this.dateRangeService.setDateRange(range);
    this.analyticsService.trackEvent('dashboard_date_range_changed', {
      period: range.period,
    });
  }

  trackByWidgetId(_: number, widget: DashboardWidgetDefinition): DashboardWidgetId {
    return widget.id;
  }

  async openCustomizeDashboard(): Promise<void> {
    this.analyticsService.trackEvent('dashboard_customize_opened', {
      visible_widget_count: this.visibleWidgets.length,
    });
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
