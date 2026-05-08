import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { Budget, Category } from '../core/database/models';
import { BudgetRepository, CategoryRepository } from '../core/database/repositories';
import { CategoryGridModalComponent } from '../shared/category-grid-selector/category-grid-modal.component';

interface BudgetFormValue {
  amount: number;
  categoryId: string;
  isActive: boolean;
}

@Component({
  selector: 'app-budget-form',
  standalone: true,
  templateUrl: './budget-form.page.html',
  styleUrls: ['./budget-form.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFormPage implements OnInit {
  loading = true;
  saving = false;
  error: string | null = null;
  budget?: Budget;
  categories: Category[] = [];

  form: BudgetFormValue = {
    amount: 0,
    categoryId: '',
    isActive: true,
  };

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    private readonly modalController: ModalController,
    private readonly toastController: ToastController,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  get isEditMode(): boolean {
    return !!this.budget;
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Edit Budget' : 'Create Budget';
  }

  get canSave(): boolean {
    return !this.loading
      && !this.saving
      && this.form.amount > 0
      && !!this.form.categoryId;
  }

  categoryById(id: string): Category | undefined {
    return this.categories.find((category) => category.id === id);
  }

  async openCategoryModal(): Promise<void> {
    if (this.saving) {
      return;
    }

    const modal = await this.modalController.create({
      component: CategoryGridModalComponent,
      componentProps: {
        title: 'Select Category',
        categories: this.categories,
        selectedCategoryIds: this.form.categoryId ? [this.form.categoryId] : [],
        includeUncategorized: false,
        singleSelect: true,
      },
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss<string>();

    if (role !== 'apply') {
      return;
    }

    this.form.categoryId = data || '';
    this.cdr.markForCheck();
  }

  async ngOnInit(): Promise<void> {
    await this.loadBudget();
  }

  async cancel(): Promise<void> {
    await this.router.navigate(['/settings/budgets']);
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      return;
    }

    try {
      this.saving = true;
      this.error = null;
      this.cdr.markForCheck();

      const now = new Date();
      const shouldBeActive = this.budget ? this.form.isActive : true;
      const selectedCategoryName = this.categoryById(this.form.categoryId)?.name?.trim() || 'Category Budget';
      const payload = {
        name: selectedCategoryName,
        amount: this.normalizeAmount(this.form.amount),
        type: 'category' as const,
        period: 'monthly' as const,
        startDate: now,
        endDate: shouldBeActive ? this.getMaxDate() : now,
        categoryIds: [this.form.categoryId],
        groupId: undefined,
        rolloverEnabled: false,
        alertThresholds: [50, 80, 100],
      };

      if (this.budget) {
        await this.budgetRepository.updateBudget(this.budget.id, payload);

        const wasActive = !this.budget.isDeleted;
        if (wasActive !== this.form.isActive) {
          await this.budgetRepository.setBudgetIsActive(this.budget.id, this.form.isActive);
        }

        await this.presentToast('Budget updated', 'success');
      } else {
        await this.budgetRepository.createBudget(payload);
        await this.presentToast('Budget created', 'success');
      }

      await this.router.navigate(['/settings/budgets']);
    } catch (error) {
      console.error('Error saving budget:', error);
      this.error = this.budget ? 'Failed to save budget changes' : 'Failed to create budget';
      await this.presentToast(this.error, 'danger');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  private async loadBudget(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;

      const [categories, budgetId] = await Promise.all([
        this.categoryRepository.getCategoriesForSettings(),
        Promise.resolve(this.activatedRoute.snapshot.paramMap.get('id')),
      ]);

      this.categories = categories.filter((category) => !category.isDeleted);

      if (!budgetId) {
        if (this.categories.length > 0) {
          this.form.categoryId = this.categories[0].id;
        }
        return;
      }

      const currentNavigation = this.router.getCurrentNavigation();
      const budgetFromNavigation = currentNavigation?.extras.state?.['budget'] as Budget | undefined;
      const budgetFromHistory = history.state?.budget as Budget | undefined;
      const stateBudget = budgetFromNavigation?.id === budgetId
        ? budgetFromNavigation
        : budgetFromHistory?.id === budgetId
          ? budgetFromHistory
          : undefined;

      const budget = stateBudget ?? await this.budgetRepository.getBudgetById(budgetId, true);

      if (!budget) {
        this.error = 'Budget not found';
        return;
      }

      this.budget = budget;
      this.form = {
        amount: this.normalizeAmount(budget.amount),
        categoryId: budget.categoryIds?.[0] || '',
        isActive: !budget.isDeleted,
      };

      if (!this.form.categoryId && this.categories.length > 0) {
        this.form.categoryId = this.categories[0].id;
      }
    } catch (error) {
      console.error('Error loading budget form:', error);
      this.error = 'Failed to load budget';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private normalizeAmount(value: number | string | null | undefined): number {
    const normalizedValue = typeof value === 'number' ? value : Number(value ?? 0);
    if (!Number.isFinite(normalizedValue)) {
      return 0;
    }

    return Math.max(0, normalizedValue);
  }

  private getMaxDate(): Date {
    return new Date(8640000000000000);
  }

  private async presentToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
