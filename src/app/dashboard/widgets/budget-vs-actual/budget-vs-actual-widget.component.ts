import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest } from 'rxjs';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonIcon,
  IonProgressBar,
  IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { walletOutline, pricetagOutline } from 'ionicons/icons';
import * as ionicons from 'ionicons/icons';
import { Budget, Category, Transaction } from '../../../core/database/models';
import { BudgetRepository, CategoryRepository, TransactionRepository } from '../../../core/database/repositories';
import { DashboardDateRange, DashboardDateRangeService } from '../../services/dashboard-date-range.service';

interface BudgetVsActualItem {
  budget: Budget;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  actualSpent: number;
  remaining: number;
  progressPercent: number;
  progressBarValue: number;
  statusLabel: string;
}

@Component({
  selector: 'app-budget-vs-actual-widget',
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonIcon,
    IonProgressBar,
    IonText,
  ],
  templateUrl: './budget-vs-actual-widget.component.html',
  styleUrls: ['./budget-vs-actual-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetVsActualWidgetComponent implements OnInit, OnDestroy {
  loading = true;
  error: string | null = null;
  hasChartData = false;

  items: BudgetVsActualItem[] = [];

  private readonly defaultIcon = 'pricetag-outline';
  private readonly registeredIconNames = new Set<string>([this.defaultIcon]);
  private subscription?: Subscription;
  private categoriesById = new Map<string, Category>();
  private latestTransactions: Transaction[] = [];
  private latestBudgets: Budget[] = [];
  private selectedDateRange: DashboardDateRange | null = null;

  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly dateRangeService: DashboardDateRangeService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    addIcons({ walletOutline, pricetagOutline });
  }

  ngOnInit(): void {
    this.subscription = combineLatest([
      this.dateRangeService.getDateRange$(),
      this.budgetRepository.getBudgets$(),
      this.transactionRepository.getTransactions$(),
    ]).subscribe({
      next: ([range, budgets, transactions]) => {
        this.selectedDateRange = range;
        this.latestBudgets = budgets;
        this.latestTransactions = transactions;
        void this.refresh();
      },
      error: (error) => {
        console.error('Error loading budget vs actual widget sources:', error);
        this.error = 'Failed to load budgets';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });

    void this.loadCategories();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get hasItems(): boolean {
    return this.items.length > 0;
  }

  trackByBudgetId(_: number, item: BudgetVsActualItem): string {
    return item.budget.id;
  }

  getBudgetIcon(item: BudgetVsActualItem): string {
    const normalized = item.categoryIcon?.trim();
    if (!normalized) {
      return this.defaultIcon;
    }

    return this.registeredIconNames.has(normalized) ? normalized : this.defaultIcon;
  }

  getBudgetIconColor(item: BudgetVsActualItem): string {
    return item.categoryColor || 'var(--ion-color-medium)';
  }

  private async loadCategories(): Promise<void> {
    const categories = await this.categoryRepository.getCategoriesForSettings();
    this.categoriesById = new Map(categories.map((category) => [category.id, category]));
    this.registerIconsFromCategories(categories);
    this.cdr.markForCheck();
  }

  private async refresh(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;

      if (this.categoriesById.size === 0) {
        await this.loadCategories();
      }

      const range = this.selectedDateRange ?? this.getFallbackDateRange();
      const activeBudgets = this.latestBudgets.filter((budget) => !budget.isDeleted && budget.amount > 0);

      this.items = activeBudgets
        .map((budget) => this.buildBudgetItem(budget, range))
        .filter((item): item is BudgetVsActualItem => !!item)
        .sort((a, b) => b.progressPercent - a.progressPercent || b.actualSpent - a.actualSpent);

      this.hasChartData = this.items.length > 0;
    } catch (error) {
      console.error('Error building budget vs actual widget:', error);
      this.error = 'Failed to load budget comparison';
      this.items = [];
      this.hasChartData = false;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private buildBudgetItem(budget: Budget, range: DashboardDateRange): BudgetVsActualItem | null {
    const categoryIds = (budget.categoryIds ?? []).filter(Boolean);
    if (categoryIds.length === 0) {
      return null;
    }

    const categoryId = categoryIds[0];
    const category = this.categoriesById.get(categoryId);
    const actualSpent = this.calculateActualSpent(categoryIds, range);
    const remaining = budget.amount - actualSpent;
    const progressPercent = budget.amount > 0 ? Math.max(0, (actualSpent / budget.amount) * 100) : 0;
    const progressBarValue = Math.min(1, progressPercent / 100);

    return {
      budget,
      categoryName: category?.name || budget.name || 'Budget',
      categoryIcon: category?.icon || this.defaultIcon,
      categoryColor: category?.color || 'var(--ion-color-medium)',
      actualSpent,
      remaining,
      progressPercent,
      progressBarValue,
      statusLabel: remaining >= 0 ? 'On track' : 'Over budget',
    };
  }

  private calculateActualSpent(categoryIds: string[], range: DashboardDateRange): number {
    const categorySet = new Set(categoryIds);

    return this.latestTransactions
      .filter((transaction) => {
        if (transaction.isDeleted || transaction.type !== 'expense') {
          return false;
        }

        if (!categorySet.has(transaction.categoryId)) {
          return false;
        }

        const transactionDate = new Date(transaction.date).getTime();
        const start = new Date(range.startDate).getTime();
        const end = new Date(range.endDate).getTime();

        return transactionDate >= start && transactionDate <= end;
      })
      .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  }

  private registerIconsFromCategories(categories: Category[]): void {
    const iconsToRegister: Record<string, string> = {};

    categories.forEach((category) => {
      const iconName = category.icon?.trim();
      if (!iconName || this.registeredIconNames.has(iconName)) {
        return;
      }

      const exportName = iconName.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
      const iconData = (ionicons as Record<string, string>)[exportName];

      if (!iconData) {
        return;
      }

      iconsToRegister[iconName] = iconData;
      this.registeredIconNames.add(iconName);
    });

    if (Object.keys(iconsToRegister).length > 0) {
      addIcons(iconsToRegister);
    }
  }

  private getFallbackDateRange(): DashboardDateRange {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: now,
      period: 'monthly',
    };
  }
}
