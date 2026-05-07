import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { skip, Subscription } from 'rxjs';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonIcon,
  IonText,
  ModalController,
} from '@ionic/angular/standalone';
import { ChartType, GoogleChart } from 'angular-google-charts';
import { addIcons } from 'ionicons';
import { settings, settingsOutline } from 'ionicons/icons';
import { Category, Transaction } from '../../../core/database/models';
import { DashboardDateRangeService, DashboardDateRange } from '../../services/dashboard-date-range.service';
import {
  CategoryRepository,
  TransactionRepository,
} from '../../../core/database/repositories';
import {
  WidgetSettingsModalComponent,
  WidgetSettingsOption,
  WidgetSettingsResult,
} from '../../../shared/widget-settings';

@Component({
  selector: 'app-daily-expenses-widget',
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonIcon,
    IonText,
    GoogleChart,
  ],
  templateUrl: './daily-expenses-widget.component.html',
  styleUrls: ['./daily-expenses-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyExpensesWidgetComponent implements OnInit, OnDestroy {
  private static readonly STORAGE_KEY = 'dashboard.dailyExpenses.visibleCategoryIds';
  private static readonly UNCATEGORIZED_ID = '__uncategorized__';

  loading = true;
  error: string | null = null;
  chartLoadError = false;
  hasSavedCategorySelection = false;

  readonly chartType = ChartType.LineChart;
  readonly chartColumns: string[] = ['Day', 'This Month', 'Last Month'];
  chartData: Array<[number, number | null, number | null]> = [];
  chartOptions: object = {};

  private categoriesMap = new Map<string, Category>();
  private latestTransactions: Transaction[] = [];
  private selectedCategoryIds: Set<string> | null = null;
  private transactionsSub?: Subscription;
  private dateRangeSub?: Subscription;
  private selectedDateRange: DashboardDateRange | null = null;

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly modalController: ModalController,
    private readonly cdr: ChangeDetectorRef,
    private readonly dateRangeService: DashboardDateRangeService,
  ) {
    addIcons({ settings, settingsOutline });
  }

  ngOnInit(): void {
    // Subscribe to dashboard date range changes
    this.dateRangeSub = this.dateRangeService.getDateRange$().subscribe((range) => {
      this.selectedDateRange = range;
      console.log('Selected date range changed from widget:', range);
      void this.initialize();
    });
  }

  ngOnDestroy(): void {
    this.transactionsSub?.unsubscribe();
    this.dateRangeSub?.unsubscribe();
  }

  get hasChartData(): boolean {
    return this.chartData.some(([, currentValue, lastValue]) => currentValue !== null || lastValue !== null);
  }

  get settingsIconName(): string {
    return this.hasSavedCategorySelection ? 'settings' : 'settings-outline';
  }

  async openCategorySettings(): Promise<void> {
    const modal = await this.modalController.create({
      component: WidgetSettingsModalComponent,
      componentProps: {
        options: this.getCategorySelectionOptions(),
        selectedIds: this.selectedCategoryIds ? Array.from(this.selectedCategoryIds) : null,
      },
      breakpoints: [0, 0.7, 0.95],
      initialBreakpoint: 0.7,
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss<WidgetSettingsResult>();

    if (role !== 'apply' || !data) {
      return;
    }

    this.selectedCategoryIds = data.selectedIds ? new Set<string>(data.selectedIds) : null;
    this.persistCategorySelection(this.selectedCategoryIds);
    this.rebuildChart();
  }

  onChartError(): void {
    this.chartLoadError = true;
    this.cdr.markForCheck();
  }

  private async initialize(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      this.chartLoadError = false;
      this.cdr.markForCheck();

      this.loadSavedCategorySelection();

      await this.refreshCategories();
      this.sanitizeSavedSelection();

      await this.loadTransactionsForComparison();

      this.transactionsSub = this.transactionRepository.transactions$
        .pipe(skip(1))
        .subscribe(() => {
          void this.loadTransactionsForComparison();
        });

      this.loading = false;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error initializing daily expenses widget:', error);
      this.error = 'Failed to load daily expenses';
      this.chartData = [];
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async refreshCategories(): Promise<void> {
    const categories = await this.categoryRepository.getCategoriesForSettings();
    this.categoriesMap = new Map<string, Category>(
      categories.map((category) => [category.id, category])
    );
  }

  private buildChart(transactions: Transaction[]): void {
    // Only handle monthly period
    let currentPeriodStart: Date, currentPeriodEnd: Date, prevPeriodStart: Date, prevPeriodEnd: Date;
    let labelCurrent = 'Current', labelPrev = 'Previous';
    if (this.selectedDateRange && this.selectedDateRange.period === 'monthly') {
      currentPeriodStart = new Date(this.selectedDateRange.startDate);
      currentPeriodEnd = new Date(this.selectedDateRange.endDate);
      prevPeriodStart = new Date(currentPeriodStart.getFullYear(), currentPeriodStart.getMonth() - 1, 1);
      prevPeriodEnd = new Date(currentPeriodStart.getFullYear(), currentPeriodStart.getMonth(), 0, 23, 59, 59, 999);
      labelCurrent = currentPeriodStart.toLocaleString('default', { month: 'short', year: 'numeric' });
      labelPrev = prevPeriodStart.toLocaleString('default', { month: 'short', year: 'numeric' });
    } else {
      // fallback: current and previous month
      const now = new Date();
      currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      prevPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      labelCurrent = currentPeriodStart.toLocaleString('default', { month: 'short', year: 'numeric' });
      labelPrev = prevPeriodStart.toLocaleString('default', { month: 'short', year: 'numeric' });
    }

    // Group transactions by day for each period
    const currentTotals = new Map<number, number>();
    const prevTotals = new Map<number, number>();

    transactions
      .filter((transaction) => transaction.type === 'expense' && this.isCategoryVisible(transaction.categoryId))
      .forEach((transaction) => {
        const transactionDate = new Date(transaction.date);
        const amount = Math.abs(transaction.amount);
        if (transactionDate >= currentPeriodStart && transactionDate <= currentPeriodEnd) {
          const day = transactionDate.getDate();
          currentTotals.set(day, (currentTotals.get(day) ?? 0) + amount);
        } else if (transactionDate >= prevPeriodStart && transactionDate <= prevPeriodEnd) {
          const day = transactionDate.getDate();
          prevTotals.set(day, (prevTotals.get(day) ?? 0) + amount);
        }
      });

    // Determine max days for chart
    const daysInCurrent = this.getDaysInMonth(currentPeriodEnd.getFullYear(), currentPeriodEnd.getMonth());
    const daysInPrev = this.getDaysInMonth(prevPeriodEnd.getFullYear(), prevPeriodEnd.getMonth());
    const maxDays = Math.max(daysInCurrent, daysInPrev);

    const rows: Array<[number, number | null, number | null]> = [];
    for (let day = 1; day <= maxDays; day += 1) {
      const currentValue = day <= daysInCurrent ? (currentTotals.get(day) ?? 0) : null;
      const prevValue = day <= daysInPrev ? (prevTotals.get(day) ?? 0) : null;
      rows.push([day, currentValue, prevValue]);
    }

    this.chartColumns[1] = labelCurrent;
    this.chartColumns[2] = labelPrev;
    this.chartData = rows;

    const textColor = this.getComputedColor('--ion-text-color') || '#000000';
    const primaryColor = this.getComputedColor('--ion-color-primary') || '#667EEA';
    const secondaryColor = this.getComputedColor('--ion-color-secondary') || '#764BA2';

    this.chartOptions = {
      backgroundColor: 'transparent',
      chartArea: { width: '86%', height: '70%' },
      legend: {
        position: 'bottom',
        textStyle: { color: textColor, fontSize: 12 },
      },
      hAxis: {
        title: 'Day',
        textStyle: { color: textColor },
        titleTextStyle: { color: textColor },
        gridlines: { color: 'transparent' },
      },
      vAxis: {
        title: 'Amount',
        textStyle: { color: textColor },
        titleTextStyle: { color: textColor },
        minValue: 0,
      },
      interpolateNulls: false,
      pointSize: 3,
      curveType: 'function',
      colors: [primaryColor, secondaryColor],
    };
  }

  private rebuildChart(): void {
    this.buildChart(this.latestTransactions);
    this.cdr.markForCheck();
  }

  private loadSavedCategorySelection(): void {
    const savedValue = localStorage.getItem(DailyExpensesWidgetComponent.STORAGE_KEY);

    if (!savedValue) {
      this.selectedCategoryIds = null;
      this.hasSavedCategorySelection = false;
      return;
    }

    try {
      const parsed = JSON.parse(savedValue);

      if (!Array.isArray(parsed)) {
        throw new Error('Invalid category selection format');
      }

      const selectedIds = parsed.filter((value): value is string => typeof value === 'string');
      this.selectedCategoryIds = new Set<string>(selectedIds);
      this.hasSavedCategorySelection = true;
    } catch {
      localStorage.removeItem(DailyExpensesWidgetComponent.STORAGE_KEY);
      this.selectedCategoryIds = null;
      this.hasSavedCategorySelection = false;
    }
  }

  private persistCategorySelection(selectedCategoryIds: Set<string> | null): void {
    if (!selectedCategoryIds) {
      localStorage.removeItem(DailyExpensesWidgetComponent.STORAGE_KEY);
      this.hasSavedCategorySelection = false;
      return;
    }

    localStorage.setItem(
      DailyExpensesWidgetComponent.STORAGE_KEY,
      JSON.stringify(Array.from(selectedCategoryIds))
    );
    this.hasSavedCategorySelection = true;
  }

  private sanitizeSavedSelection(): void {
    if (!this.selectedCategoryIds) {
      return;
    }

    const validCategoryIds = new Set<string>([
      ...Array.from(this.categoriesMap.keys()),
      DailyExpensesWidgetComponent.UNCATEGORIZED_ID,
    ]);

    const sanitizedSelection = new Set<string>(
      Array.from(this.selectedCategoryIds).filter((id) => validCategoryIds.has(id))
    );

    if (sanitizedSelection.size === this.selectedCategoryIds.size) {
      return;
    }

    this.selectedCategoryIds = sanitizedSelection;
    this.persistCategorySelection(this.selectedCategoryIds);
  }

  private getCategorySelectionOptions(): WidgetSettingsOption[] {
    const categoryOptions = Array.from(this.categoriesMap.values())
      .sort((first, second) => first.name.localeCompare(second.name))
      .map((category) => ({
        id: category.id,
        label: category.name,
        icon: category.icon || undefined,
        color: category.color || undefined,
      }));

    return [
      ...categoryOptions,
      {
        id: DailyExpensesWidgetComponent.UNCATEGORIZED_ID,
        label: 'Uncategorized',
      },
    ];
  }

  private normalizeCategoryId(categoryId: string): string {
    return categoryId || DailyExpensesWidgetComponent.UNCATEGORIZED_ID;
  }

  private isCategoryVisible(categoryId: string): boolean {
    if (!this.selectedCategoryIds) {
      return true;
    }

    return this.selectedCategoryIds.has(this.normalizeCategoryId(categoryId));
  }

  private getDaysInMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  private getComparisonRange(): [Date, Date] {
    // Use selected date range from service, fallback to previous logic if not set
    if (this.selectedDateRange) {
      // For monthly, compare with previous month; for others, just use the selected range
      if (this.selectedDateRange.period === 'monthly') {
        const start = new Date(this.selectedDateRange.startDate);
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(this.selectedDateRange.endDate);
        end.setHours(23, 59, 59, 999);
        return [start, end];
      } else {
        const start = new Date(this.selectedDateRange.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(this.selectedDateRange.endDate);
        end.setHours(23, 59, 59, 999);
        return [start, end];
      }
    }
    // fallback: current and previous month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return [start, end];
  }

  private async loadTransactionsForComparison(): Promise<void> {
    const [rangeStart, rangeEnd] = this.getComparisonRange();
    const transactions = await this.transactionRepository.queryTransactions(
      {},
      { dateRange: { startDate: rangeStart, endDate: rangeEnd } }
    );

    this.error = null;
    this.chartLoadError = false;
    this.latestTransactions = transactions;
    this.buildChart(transactions);
    this.cdr.markForCheck();
  }

  private getComputedColor(variable: string): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();
  }
}