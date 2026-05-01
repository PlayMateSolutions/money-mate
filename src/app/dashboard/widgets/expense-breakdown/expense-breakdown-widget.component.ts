import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
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

interface ExpenseCategorySlice {
  categoryId: string;
  categoryName: string;
  amount: number;
  color: string;
}

@Component({
  selector: 'app-expense-breakdown-widget',
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonIcon,
    IonText,
    GoogleChart,
  ],
  templateUrl: './expense-breakdown-widget.component.html',
  styleUrls: ['./expense-breakdown-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseBreakdownWidgetComponent implements OnInit, OnDestroy {
  private static readonly STORAGE_KEY = 'dashboard.expenseBreakdown.visibleCategoryIds';
  private static readonly TOP_N_STORAGE_KEY = 'dashboard.expenseBreakdown.topN';
  private static readonly GROUP_OTHERS_STORAGE_KEY = 'dashboard.expenseBreakdown.groupOthers';
  private static readonly UNCATEGORIZED_ID = '__uncategorized__';

  loading = true;
  error: string | null = null;
  chartLoadError = false;
  hasSavedCategorySelection = false;
  hasSavedTopCategoryLimit = false;
  topCategoryCount: number | null = null;
  groupOthers = true;

  readonly chartType = ChartType.PieChart;
  readonly chartColumns: string[] = ['Category', 'Amount'];
  chartData: Array<[string, number]> = [];
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
      void this.initialize();
    });
  }

  ngOnDestroy(): void {
    this.transactionsSub?.unsubscribe();
    this.dateRangeSub?.unsubscribe();
  }

  get hasChartData(): boolean {
    return this.chartData.length > 0;
  }

  get hasSavedSettings(): boolean {
    return this.hasSavedCategorySelection || this.hasSavedTopCategoryLimit;
  }

  get settingsIconName(): string {
    return this.hasSavedSettings ? 'settings' : 'settings-outline';
  }

  async openCategorySettings(): Promise<void> {
    const modal = await this.modalController.create({
      component: WidgetSettingsModalComponent,
      componentProps: {
        options: this.getCategorySelectionOptions(),
        selectedIds: this.selectedCategoryIds ? Array.from(this.selectedCategoryIds) : null,
        topN: {
          value: this.topCategoryCount,
          label: 'Show top categories',
          helperText: 'Leave empty to show all categories. When limited, remaining categories are grouped into Other.',
          placeholder: 'All categories',
          min: 1,
          max: Math.max(this.categoriesMap.size + 1, 1),
          groupOthers: this.groupOthers,
        },
      },
      breakpoints: [0, 0.72, 0.95],
      initialBreakpoint: 0.72,
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss<WidgetSettingsResult>();

    if (role !== 'apply' || !data) {
      return;
    }

    this.selectedCategoryIds = data.selectedIds ? new Set<string>(data.selectedIds) : null;
    this.persistCategorySelection(this.selectedCategoryIds);
    // If data.topN is null or undefined, persist null (not default)
    this.persistTopCategoryCount(
      data.topN ?? null
    );
    this.persistGroupOthers(data.groupOthers ?? true);
    console.log('Updated category selection:', {
      selectedCategoryIds: this.selectedCategoryIds,
      topCategoryCount: this.topCategoryCount,
      groupOthers: this.groupOthers,
    });
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
      this.loadSavedTopCategoryCount();
      this.loadSavedGroupOthers();

      await this.refreshCategories();
      this.sanitizeSavedSelection();

      this.transactionsSub = this.transactionRepository.getTransactions$().subscribe({
        next: (transactions) => {
          this.error = null;
          this.chartLoadError = false;
          this.latestTransactions = transactions;
          this.buildChart(transactions);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error loading transactions for expense breakdown:', error);
          this.error = 'Failed to load expense breakdown';
          this.chartData = [];
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
    } catch (error) {
      console.error('Error initializing expense breakdown widget:', error);
      this.error = 'Failed to load expense breakdown';
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
    // Only show expenses for the selected month
    let monthStart: Date, monthEnd: Date, label: string;
    if (this.selectedDateRange && this.selectedDateRange.period === 'monthly') {
      monthStart = new Date(this.selectedDateRange.startDate);
      monthEnd = new Date(this.selectedDateRange.endDate);
      label = monthStart.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else {
      // fallback: current month
      const now = new Date();
      monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      label = monthStart.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    const monthExpenses = transactions.filter((transaction) =>
      transaction.type === 'expense' &&
      this.isInMonth(new Date(transaction.date), monthStart, monthEnd) &&
      this.isCategoryVisible(transaction.categoryId)
    );

    const groupedByCategory = new Map<string, ExpenseCategorySlice>();
    const fallbackColor = this.getMediumColor();

    monthExpenses.forEach((transaction) => {
      const key = this.normalizeCategoryId(transaction.categoryId);
      const category = this.categoriesMap.get(key);
      const existing = groupedByCategory.get(key);

      if (existing) {
        existing.amount += Math.abs(transaction.amount);
        return;
      }

      groupedByCategory.set(key, {
        categoryId: key,
        categoryName: category?.name ?? 'Uncategorized',
        amount: Math.abs(transaction.amount),
        color: category?.color ?? fallbackColor,
      });
    });

    const sortedSlices = Array.from(groupedByCategory.values())
      .sort((a, b) => b.amount - a.amount);

    const slices = this.applyTopCategoryLimit(sortedSlices);

    this.chartData = slices.map((slice) => [
      `${slice.categoryName}`,
      slice.amount,
    ]);

    const textColor = this.getComputedColor('--ion-text-color') || '#000000';

    this.chartOptions = {
      backgroundColor: 'transparent',
      chartArea: { width: '88%', height: '78%' },
      legend: {
        position: 'right',
        alignment: 'center',
        textStyle: { color: textColor, fontSize: 12 },
      },
      pieSliceText: 'percentage',
      tooltip: { text: 'value' },
      colors: slices.map((slice) => slice.color),
    };
  }

  private rebuildChart(): void {
    this.buildChart(this.latestTransactions);
    this.cdr.markForCheck();
  }

  private loadSavedCategorySelection(): void {
    const savedValue = localStorage.getItem(ExpenseBreakdownWidgetComponent.STORAGE_KEY);

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
      localStorage.removeItem(ExpenseBreakdownWidgetComponent.STORAGE_KEY);
      this.selectedCategoryIds = null;
      this.hasSavedCategorySelection = false;
    }
  }

  private persistCategorySelection(selectedCategoryIds: Set<string> | null): void {
    if (!selectedCategoryIds) {
      localStorage.removeItem(ExpenseBreakdownWidgetComponent.STORAGE_KEY);
      this.hasSavedCategorySelection = false;
      return;
    }

    localStorage.setItem(
      ExpenseBreakdownWidgetComponent.STORAGE_KEY,
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
      ExpenseBreakdownWidgetComponent.UNCATEGORIZED_ID,
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
      }));

    return [
      ...categoryOptions,
      {
        id: ExpenseBreakdownWidgetComponent.UNCATEGORIZED_ID,
        label: 'Uncategorized',
      },
    ];
  }

  private normalizeCategoryId(categoryId: string): string {
    return categoryId || ExpenseBreakdownWidgetComponent.UNCATEGORIZED_ID;
  }

  private isCategoryVisible(categoryId: string): boolean {
    if (!this.selectedCategoryIds) {
      return true;
    }

    return this.selectedCategoryIds.has(this.normalizeCategoryId(categoryId));
  }

  private isInMonth(date: Date, monthStart: Date, monthEnd: Date): boolean {
    return date >= monthStart && date <= monthEnd;
  }

  private getComputedColor(variable: string): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();
  }

  private getMediumColor(): string {
    return this.getComputedColor('--ion-color-medium');
  }

  private loadSavedTopCategoryCount(): void {
    const savedValue = localStorage.getItem(ExpenseBreakdownWidgetComponent.TOP_N_STORAGE_KEY);

    if (savedValue === null) {
      this.topCategoryCount = null;
      this.hasSavedTopCategoryLimit = false;
      return;
    }

    try {
      const parsed = JSON.parse(savedValue) as number | null;

      if (parsed === null) {
        this.topCategoryCount = null;
        this.hasSavedTopCategoryLimit = true;
        return;
      }

      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('Invalid top category limit');
      }

      this.topCategoryCount = parsed;
      this.hasSavedTopCategoryLimit = parsed !== null;
    } catch {
      localStorage.removeItem(ExpenseBreakdownWidgetComponent.TOP_N_STORAGE_KEY);
      this.topCategoryCount = null;
      this.hasSavedTopCategoryLimit = false;
    }
  }

  private persistTopCategoryCount(value: number | null): void {
    if (value === null) {
      localStorage.removeItem(ExpenseBreakdownWidgetComponent.TOP_N_STORAGE_KEY);
      this.topCategoryCount = value;
      this.hasSavedTopCategoryLimit = false;
      return;
    }

    localStorage.setItem(
      ExpenseBreakdownWidgetComponent.TOP_N_STORAGE_KEY,
      JSON.stringify(value),
    );
    this.topCategoryCount = value;
    this.hasSavedTopCategoryLimit = true;
  }

  private loadSavedGroupOthers(): void {
    const savedValue = localStorage.getItem(
      ExpenseBreakdownWidgetComponent.GROUP_OTHERS_STORAGE_KEY,
    );

    if (savedValue === null) {
      this.groupOthers = true;
      return;
    }

    try {
      this.groupOthers = JSON.parse(savedValue) !== false;
    } catch {
      localStorage.removeItem(ExpenseBreakdownWidgetComponent.GROUP_OTHERS_STORAGE_KEY);
      this.groupOthers = true;
    }
  }

  private persistGroupOthers(value: boolean): void {
    if (value) {
      localStorage.removeItem(ExpenseBreakdownWidgetComponent.GROUP_OTHERS_STORAGE_KEY);
    } else {
      localStorage.setItem(
        ExpenseBreakdownWidgetComponent.GROUP_OTHERS_STORAGE_KEY,
        JSON.stringify(false),
      );
    }
    this.groupOthers = value;
  }

  private applyTopCategoryLimit(slices: ExpenseCategorySlice[]): ExpenseCategorySlice[] {
    if (this.topCategoryCount === null || slices.length <= this.topCategoryCount) {
      return slices;
    }

    const topSlices = slices.slice(0, this.topCategoryCount);
    const remaining = slices.slice(this.topCategoryCount);

    if (!this.groupOthers) {
      return topSlices;
    }

    const otherAmount = remaining.reduce((sum, s) => sum + s.amount, 0);

    if (otherAmount <= 0) {
      return topSlices;
    }

    return [
      ...topSlices,
      {
        categoryId: '__other__',
        categoryName: 'Other',
        amount: otherAmount,
        color: this.getMediumColor(),
      },
    ];
  }
}
