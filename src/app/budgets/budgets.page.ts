import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonBadge,
  IonButton,
  IonItemDivider,
  IonSpinner,
  IonFab,
  IonFabButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, createOutline, pricetagOutline } from 'ionicons/icons';
import * as ionicons from 'ionicons/icons';
import { Budget, Category } from '../core/database/models';
import { BudgetRepository, CategoryRepository } from '../core/database/repositories';

@Component({
  selector: 'app-budgets',
  templateUrl: './budgets.page.html',
  styleUrls: ['./budgets.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonButton,
    IonItemDivider,
    IonSpinner,
    IonFab,
    IonFabButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetsPage implements OnInit {
  private readonly CURRENCY_KEY = 'money-mate-currency';
  budgets: Budget[] = [];
  selectedCurrency = 'USD';
  loading = true;
  error: string | null = null;
  private categoriesById = new Map<string, Category>();
  private readonly defaultIcon = 'pricetag-outline';
  private readonly registeredIconNames = new Set<string>(['create-outline', 'pricetag-outline']);

  constructor(
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {
    addIcons({ add, createOutline, pricetagOutline });
  }

  ngOnInit(): void {
    this.loadSelectedCurrency();
    void this.loadBudgets();
  }

  ionViewWillEnter(): void {
    this.loadSelectedCurrency();
    void this.loadBudgets();
  }

  get activeBudgets(): Budget[] {
    return this.budgets.filter((budget) => !budget.isDeleted);
  }

  get inactiveBudgets(): Budget[] {
    return this.budgets.filter((budget) => budget.isDeleted);
  }

  trackByBudgetId(_: number, budget: Budget): string {
    return budget.id;
  }

  getPrimaryCategoryName(budget: Budget): string {
    const categoryId = budget.categoryIds?.[0];
    if (!categoryId) {
      return 'Unassigned';
    }

    return this.categoriesById.get(categoryId)?.name || 'Unknown category';
  }

  getBudgetDisplayName(budget: Budget): string {
    return this.getPrimaryCategoryName(budget) || budget.name || 'Category Budget';
  }

  getMonthLabel(budget: Budget): string {
    const monthDate = new Date(budget.startDate);
    return monthDate.toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
    });
  }

  getBudgetIcon(budget: Budget): string {
    const categoryId = budget.categoryIds?.[0];
    const iconName = categoryId ? this.categoriesById.get(categoryId)?.icon : undefined;
    const normalizedName = iconName?.trim();
    if (!normalizedName) {
      return this.defaultIcon;
    }

    return this.registeredIconNames.has(normalizedName) ? normalizedName : this.defaultIcon;
  }

  getBudgetIconColor(budget: Budget): string {
    const categoryId = budget.categoryIds?.[0];
    const color = categoryId ? this.categoriesById.get(categoryId)?.color : undefined;
    const normalizedColor = color?.trim();
    return normalizedColor || 'var(--ion-color-medium)';
  }

  async openEditPage(budget: Budget): Promise<void> {
    await this.router.navigate(['/settings/budgets', budget.id], {
      state: {
        budget,
      },
    });
  }

  async openCreatePage(): Promise<void> {
    await this.router.navigate(['/settings/budgets/new']);
  }

  private loadSelectedCurrency(): void {
    this.selectedCurrency = localStorage.getItem(this.CURRENCY_KEY) || 'USD';
  }

  private async loadBudgets(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;

      const [budgets, categories] = await Promise.all([
        this.budgetRepository.getBudgetsForSettings(),
        this.categoryRepository.getCategoriesForSettings(),
      ]);

      this.budgets = budgets;
      this.categoriesById = new Map(categories.map((category) => [category.id, category]));
      this.registerIconsFromCategories(categories);
    } catch (error) {
      console.error('Error loading budgets for management:', error);
      this.error = 'Failed to load budgets';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
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
}
