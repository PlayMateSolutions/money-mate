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
import { Category } from '../../../core/database/models';
import {
  CategoryRepository,
  TransactionRepository,
} from '../../../core/database/repositories';
import {
  WidgetSettingsModalComponent,
  WidgetSettingsOption,
  WidgetSettingsResult,
} from '../../../shared/widget-settings';

interface CategoryExpense {
  categoryId: string;
  categoryName: string;
  currentMonthAmount: number;
  avgMonthlyAmount: number;
}

@Component({
  selector: 'app-expense-comparison-widget',
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
  templateUrl: './expense-comparison-widget.component.html',
  styleUrls: ['./expense-comparison-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseComparisonWidgetComponent implements OnInit, OnDestroy {
  private static readonly STORAGE_KEY = 'dashboard.expenseComparison.visibleCategoryIds';
  private static readonly TOP_N_STORAGE_KEY = 'dashboard.expenseComparison.topN';
  private static readonly GROUP_OTHERS_STORAGE_KEY = 'dashboard.expenseComparison.groupOthers';
  private static readonly UNCATEGORIZED_ID = '__uncategorized__';
  private static readonly DEFAULT_TOP_CATEGORY_COUNT = 6;

  loading = true;
  error: string | null = null;
  chartLoadError = false;
  hasSavedCategorySelection = false;
  hasSavedTopCategoryLimit = false;
  groupOthers = true;

  readonly chartType = ChartType.ColumnChart;
  readonly chartColumns: string[] = ['Category', 'This Month', 'Monthly Avg'];
  chartData: Array<[string, number, number]> = [];
  chartOptions: object = {};
  chartWidth = 320;
  topCategoryCount: number | null = ExpenseComparisonWidgetComponent.DEFAULT_TOP_CATEGORY_COUNT;

  private categoriesMap = new Map<string, Category>();
  private selectedCategoryIds: Set<string> | null = null;
  private transactionsSub?: Subscription;

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly modalController: ModalController,
    private readonly cdr: ChangeDetectorRef,
  ) {
    addIcons({ settings, settingsOutline });
  }

  ngOnInit(): void {
    void this.initialize();
  }

  ngOnDestroy(): void {
    this.transactionsSub?.unsubscribe();
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
    // If data.topN is null, persist null (not default)
    this.persistTopCategoryCount(
      data.topN === null ? null : data.topN ?? ExpenseComparisonWidgetComponent.DEFAULT_TOP_CATEGORY_COUNT
    );
    this.persistGroupOthers(data.groupOthers ?? true);
    void this.loadAndBuildChart();
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
      await this.loadAndBuildChart();

      this.transactionsSub = this.transactionRepository.transactions$
        .pipe(skip(1))
        .subscribe(() => {
          void this.loadAndBuildChart();
        });

      this.loading = false;
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error initializing expense comparison widget:', err);
      this.error = 'Failed to load expense comparison';
      this.chartData = [];
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private async refreshCategories(): Promise<void> {
    const categories = await this.categoryRepository.getCategoriesForSettings();
    this.categoriesMap = new Map<string, Category>(
      categories.map((c) => [c.id, c]),
    );
  }

  private async loadAndBuildChart(): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Date range: Jan 1 of this year → today
    const ytdStart = new Date(currentYear, 0, 1, 0, 0, 0, 0);
    const ytdEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const allYtdTransactions = await this.transactionRepository.queryTransactions(
      { types: ['expense'] },
      { dateRange: { startDate: ytdStart, endDate: ytdEnd } },
    );

    // Number of fully completed months before this one (Jan=0 → March means 3 if today is April)
    const completedMonthsCount = currentMonth; // months 0..(currentMonth-1)

    // Bucket transactions
    const currentMonthTotals = new Map<string, number>();
    const ytdTotals = new Map<string, number>();

    allYtdTransactions.forEach((t) => {
      const txDate = new Date(t.date);
      const txMonth = txDate.getMonth();
      const txYear = txDate.getFullYear();
      const amount = Math.abs(t.amount);
      const key = t.categoryId || '__uncategorized__';

      if (txYear === currentYear && txMonth === currentMonth) {
        currentMonthTotals.set(key, (currentMonthTotals.get(key) ?? 0) + amount);
      } else if (txYear === currentYear && txMonth < currentMonth) {
        ytdTotals.set(key, (ytdTotals.get(key) ?? 0) + amount);
      }
    });

    // Build union of category keys that have any data (respecting filter)
    const allKeys = new Set<string>([
      ...currentMonthTotals.keys(),
      ...(completedMonthsCount > 0 ? ytdTotals.keys() : []),
    ]);

    const rows: CategoryExpense[] = [];

    allKeys.forEach((key) => {
      if (!this.isCategoryVisible(key)) return;
      const category = this.categoriesMap.get(key);
      const categoryName = category?.name ?? 'Uncategorized';
      const currentAmount = currentMonthTotals.get(key) ?? 0;
      const ytdAmount = ytdTotals.get(key) ?? 0;
      const avgAmount = completedMonthsCount > 0
        ? parseFloat((ytdAmount / completedMonthsCount).toFixed(2))
        : 0;

      rows.push({ categoryId: key, categoryName, currentMonthAmount: currentAmount, avgMonthlyAmount: avgAmount });
    });

    // Sort by current month spend descending
    rows.sort((a, b) => b.currentMonthAmount - a.currentMonthAmount);

    const visibleRows = this.applyTopCategoryLimit(rows);

    this.chartData = visibleRows.map((r) => [r.categoryName, r.currentMonthAmount, r.avgMonthlyAmount]);

    // Dynamic width for horizontal scroll
    this.chartWidth = Math.max(visibleRows.length * 90, 320);

    const textColor = this.getComputedColor('--ion-text-color') || '#000000';
    const primaryColor = this.getComputedColor('--ion-color-primary') || '#667EEA';
    const secondaryColor = this.getComputedColor('--ion-color-secondary') || '#2EC4B6';

    const currentMonthLabel = now.toLocaleString('default', { month: 'long' });

    this.chartOptions = {
      backgroundColor: 'transparent',
      chartArea: {
        left: 44,
        top: 40,
        width: '88%',
        height: '65%',
      },
      legend: {
        position: 'top',
        textStyle: { color: textColor, fontSize: 12 },
      },
      hAxis: {
        title: 'Category',
        textStyle: { color: textColor, fontSize: 11 },
        titleTextStyle: { color: textColor },
        slantedText: true,
        slantedTextAngle: 40,
      },
      vAxis: {
        title: 'Amount',
        textStyle: { color: textColor },
        titleTextStyle: { color: textColor },
        minValue: 0,
        format: 'short',
      },
      bar: { groupWidth: '72%' },
      colors: [primaryColor, secondaryColor],
      tooltip: { isHtml: false },
      seriesType: 'bars',
      series: {
        0: { labelInLegend: currentMonthLabel },
        1: { labelInLegend: 'Monthly Avg' },
      },
    };

    this.error = null;
    this.chartLoadError = false;
    this.loading = false;
    this.cdr.markForCheck();
  }

  private loadSavedCategorySelection(): void {
    const savedValue = localStorage.getItem(ExpenseComparisonWidgetComponent.STORAGE_KEY);
    if (!savedValue) {
      this.selectedCategoryIds = null;
      this.hasSavedCategorySelection = false;
      return;
    }
    try {
      const parsed = JSON.parse(savedValue);
      if (!Array.isArray(parsed)) throw new Error('Invalid format');
      this.selectedCategoryIds = new Set<string>(
        parsed.filter((v): v is string => typeof v === 'string')
      );
      this.hasSavedCategorySelection = true;
    } catch {
      localStorage.removeItem(ExpenseComparisonWidgetComponent.STORAGE_KEY);
      this.selectedCategoryIds = null;
      this.hasSavedCategorySelection = false;
    }
  }

  private persistCategorySelection(ids: Set<string> | null): void {
    if (!ids) {
      localStorage.removeItem(ExpenseComparisonWidgetComponent.STORAGE_KEY);
      this.hasSavedCategorySelection = false;
      return;
    }
    localStorage.setItem(
      ExpenseComparisonWidgetComponent.STORAGE_KEY,
      JSON.stringify(Array.from(ids)),
    );
    this.hasSavedCategorySelection = true;
  }

  private loadSavedTopCategoryCount(): void {
    const savedValue = localStorage.getItem(ExpenseComparisonWidgetComponent.TOP_N_STORAGE_KEY);

    if (savedValue === null) {
      this.topCategoryCount = ExpenseComparisonWidgetComponent.DEFAULT_TOP_CATEGORY_COUNT;
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
      this.hasSavedTopCategoryLimit = parsed !== ExpenseComparisonWidgetComponent.DEFAULT_TOP_CATEGORY_COUNT;
    } catch {
      localStorage.removeItem(ExpenseComparisonWidgetComponent.TOP_N_STORAGE_KEY);
      this.topCategoryCount = ExpenseComparisonWidgetComponent.DEFAULT_TOP_CATEGORY_COUNT;
      this.hasSavedTopCategoryLimit = false;
    }
  }

  private persistTopCategoryCount(value: number | null): void {
    if (value === ExpenseComparisonWidgetComponent.DEFAULT_TOP_CATEGORY_COUNT) {
      localStorage.removeItem(ExpenseComparisonWidgetComponent.TOP_N_STORAGE_KEY);
      this.topCategoryCount = value;
      this.hasSavedTopCategoryLimit = false;
      return;
    }

    localStorage.setItem(
      ExpenseComparisonWidgetComponent.TOP_N_STORAGE_KEY,
      JSON.stringify(value),
    );

    this.topCategoryCount = value;
    this.hasSavedTopCategoryLimit = true;
  }

  private sanitizeSavedSelection(): void {
    if (!this.selectedCategoryIds) return;
    const validIds = new Set<string>([
      ...Array.from(this.categoriesMap.keys()),
      ExpenseComparisonWidgetComponent.UNCATEGORIZED_ID,
    ]);
    const sanitized = new Set<string>(
      Array.from(this.selectedCategoryIds).filter((id) => validIds.has(id))
    );
    if (sanitized.size !== this.selectedCategoryIds.size) {
      this.selectedCategoryIds = sanitized;
      this.persistCategorySelection(this.selectedCategoryIds);
    }
  }

  private getCategorySelectionOptions(): WidgetSettingsOption[] {
    return [
      ...Array.from(this.categoriesMap.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, label: c.name })),
      { id: ExpenseComparisonWidgetComponent.UNCATEGORIZED_ID, label: 'Uncategorized' },
    ];
  }

  private loadSavedGroupOthers(): void {
    const savedValue = localStorage.getItem(
      ExpenseComparisonWidgetComponent.GROUP_OTHERS_STORAGE_KEY,
    );

    if (savedValue === null) {
      this.groupOthers = true;
      return;
    }

    try {
      this.groupOthers = JSON.parse(savedValue) !== false;
    } catch {
      localStorage.removeItem(ExpenseComparisonWidgetComponent.GROUP_OTHERS_STORAGE_KEY);
      this.groupOthers = true;
    }
  }

  private persistGroupOthers(value: boolean): void {
    if (value) {
      localStorage.removeItem(ExpenseComparisonWidgetComponent.GROUP_OTHERS_STORAGE_KEY);
    } else {
      localStorage.setItem(
        ExpenseComparisonWidgetComponent.GROUP_OTHERS_STORAGE_KEY,
        JSON.stringify(false),
      );
    }
    this.groupOthers = value;
  }

  private applyTopCategoryLimit(rows: CategoryExpense[]): CategoryExpense[] {
    if (this.topCategoryCount === null || rows.length <= this.topCategoryCount) {
      return rows;
    }

    const topRows = rows.slice(0, this.topCategoryCount);
    const remainingRows = rows.slice(this.topCategoryCount);

    if (!this.groupOthers) {
      return topRows;
    }

    const otherRow = remainingRows.reduce<CategoryExpense>(
      (acc, row) => ({
        categoryId: '__other__',
        categoryName: 'Other',
        currentMonthAmount: acc.currentMonthAmount + row.currentMonthAmount,
        avgMonthlyAmount: acc.avgMonthlyAmount + row.avgMonthlyAmount,
      }),
      {
        categoryId: '__other__',
        categoryName: 'Other',
        currentMonthAmount: 0,
        avgMonthlyAmount: 0,
      },
    );

    return otherRow.currentMonthAmount > 0 || otherRow.avgMonthlyAmount > 0
      ? [...topRows, otherRow]
      : topRows;
  }

  private isCategoryVisible(key: string): boolean {
    if (!this.selectedCategoryIds) return true;
    return this.selectedCategoryIds.has(key);
  }

  private getComputedColor(variable: string): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();
  }
}
