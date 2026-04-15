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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonText,
} from '@ionic/angular/standalone';
import { ChartType, GoogleChart } from 'angular-google-charts';
import { Category, Transaction } from '../../../core/database/models';
import {
  CategoryRepository,
  TransactionRepository,
} from '../../../core/database/repositories';

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
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonText,
    GoogleChart,
  ],
  templateUrl: './expense-breakdown-widget.component.html',
  styleUrls: ['./expense-breakdown-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseBreakdownWidgetComponent implements OnInit, OnDestroy {
  loading = true;
  error: string | null = null;
  chartLoadError = false;

  readonly chartType = ChartType.PieChart;
  readonly chartColumns: string[] = ['Category', 'Amount'];
  chartData: Array<[string, number]> = [];
  chartOptions: object = {
    backgroundColor: 'transparent',
    chartArea: { width: '88%', height: '78%' },
    legend: {
      position: 'right',
      alignment: 'center',
      textStyle: { color: 'var(--ion-text-color)', fontSize: 12 },
    },
    pieSliceText: 'percentage',
    tooltip: { text: 'value' },
  };

  private categoriesMap = new Map<string, Category>();
  private transactionsSub?: Subscription;

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.initialize();
  }

  ngOnDestroy(): void {
    this.transactionsSub?.unsubscribe();
  }

  get hasChartData(): boolean {
    return this.chartData.length > 0;
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

      await this.refreshCategories();

      this.transactionsSub = this.transactionRepository.getTransactions$().subscribe({
        next: (transactions) => {
          this.error = null;
          this.chartLoadError = false;
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
    const currentMonthExpenses = transactions.filter((transaction) =>
      transaction.type === 'expense' &&
      this.isInCurrentMonth(new Date(transaction.date))
    );

    const groupedByCategory = new Map<string, ExpenseCategorySlice>();
    const fallbackColor = this.getMediumColor();

    currentMonthExpenses.forEach((transaction) => {
      const category = this.categoriesMap.get(transaction.categoryId);
      const key = transaction.categoryId || 'uncategorized';
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

    const slices = Array.from(groupedByCategory.values())
      .sort((a, b) => b.amount - a.amount);

    this.chartData = slices.map((slice) => [slice.categoryName, slice.amount]);
    this.chartOptions = {
      ...this.chartOptions,
      colors: slices.map((slice) => slice.color),
    };
  }

  private isInCurrentMonth(date: Date): boolean {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  private getMediumColor(): string {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--ion-color-medium')
      .trim();
  }
}
