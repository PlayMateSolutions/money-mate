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
} from '@ionic/angular/standalone';
import { AlertController } from '@ionic/angular';
import { ChartType, GoogleChart } from 'angular-google-charts';
import { addIcons } from 'ionicons';
import { settings, settingsOutline } from 'ionicons/icons';
import { Category } from '../../../core/database/models';
import {
  CategoryRepository,
  TransactionRepository,
} from '../../../core/database/repositories';

interface CategoryExpense {
  categoryId: string;
  categoryName: string;
  currentMonthAmount: number;
  avgMonthlyAmount: number;
}

interface CategorySelectionOption {
  id: string;
  label: string;
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
  private static readonly UNCATEGORIZED_ID = '__uncategorized__';

  loading = true;
  error: string | null = null;
  chartLoadError = false;
  hasSavedCategorySelection = false;

  readonly chartType = ChartType.ColumnChart;
  readonly chartColumns: string[] = ['Category', 'This Month', 'Monthly Avg'];
  chartData: Array<[string, number, number]> = [];
  chartOptions: object = {};
  chartWidth = 320;

  private categoriesMap = new Map<string, Category>();
  private selectedCategoryIds: Set<string> | null = null;
  private transactionsSub?: Subscription;

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly alertController: AlertController,
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

  get settingsIconName(): string {
    return this.hasSavedCategorySelection ? 'settings' : 'settings-outline';
  }

  async openCategorySettings(): Promise<void> {
    const options = this.getCategorySelectionOptions();
    const currentlySelected = this.selectedCategoryIds;

    const alert = await this.alertController.create({
      header: 'Visible categories',
      inputs: options.map((option) => ({
        type: 'checkbox' as const,
        label: option.label,
        value: option.id,
        checked: currentlySelected ? currentlySelected.has(option.id) : true,
      })),
      buttons: [
        {
          text: 'Show all',
          handler: () => {
            this.selectedCategoryIds = null;
            this.persistCategorySelection(null);
            void this.loadAndBuildChart();
          },
        },
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (selectedValues: unknown) => {
            const selectedIds = Array.isArray(selectedValues)
              ? selectedValues.filter((v): v is string => typeof v === 'string')
              : [];
            this.selectedCategoryIds = new Set<string>(selectedIds);
            this.persistCategorySelection(this.selectedCategoryIds);
            void this.loadAndBuildChart();
          },
        },
      ],
    });

    await alert.present();
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

    this.chartData = rows.map((r) => [r.categoryName, r.currentMonthAmount, r.avgMonthlyAmount]);

    // Dynamic width for horizontal scroll
    this.chartWidth = Math.max(rows.length * 90, 320);

    const textColor = this.getComputedColor('--ion-text-color') || '#000000';
    const primaryColor = this.getComputedColor('--ion-color-primary') || '#667EEA';
    const secondaryColor = this.getComputedColor('--ion-color-secondary') || '#2EC4B6';

    const currentMonthLabel = now.toLocaleString('default', { month: 'long' });

    this.chartOptions = {
      backgroundColor: 'transparent',
      chartArea: { width: '80%', height: '65%' },
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

  private getCategorySelectionOptions(): CategorySelectionOption[] {
    return [
      ...Array.from(this.categoriesMap.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, label: c.name })),
      { id: ExpenseComparisonWidgetComponent.UNCATEGORIZED_ID, label: 'Uncategorized' },
    ];
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
