import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  createOutline,
  pricetagOutline,
  add,
  cloudUploadOutline,
  syncOutline,
} from 'ionicons/icons';
import * as ionicons from 'ionicons/icons';
import { Category } from '../core/database/models';
import { CategoryRepository } from '../core/database/repositories';
import { CategoryEditModalComponent, CategoryEditModalResult } from './components/category-edit-modal.component';
import { GoogleSheetService, SessionService } from '../core/services';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
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
    IonFabButton
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoriesPage implements OnInit {
  categories: Category[] = [];
  loading = true;
  syncing = false;
  error: string | null = null;
  private registeredIconNames = new Set<string>(['create-outline', 'pricetag-outline']);
  private readonly categoryDefaultIcon = 'pricetag-outline';

  constructor(
    private categoryRepository: CategoryRepository,
    private modalController: ModalController,
    private cdr: ChangeDetectorRef,
    private readonly sessionService: SessionService,
    private readonly googleSheetService: GoogleSheetService,
    private readonly toastController: ToastController,
  ) {
    addIcons({
      createOutline,
      pricetagOutline,
      add,
      cloudUploadOutline,
      syncOutline,
    });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  get activeCategories(): Category[] {
    return this.categories.filter(category => !category.isDeleted);
  }

  get inactiveCategories(): Category[] {
    return this.categories.filter(category => category.isDeleted);
  }

  get hasDirtyCategories(): boolean {
    return this.categories.some((category) => !!category.isDirty);
  }

  get canSync(): boolean {
    return !!this.sessionService.currentSession?.accessToken && !!this.sessionService.linkedSpreadsheet?.id;
  }

  get syncEnabled(): boolean {
    return this.canSync && this.hasDirtyCategories && !this.syncing;
  }

  trackByCategoryId(_: number, category: Category): string {
    return category.id;
  }

  private getRandomCategoryColor(): string {
    return ('#' + ((Math.random() * 0xFFFFFF) << 0).toString(16).padStart(6, '0')).toUpperCase();
  }

  getCategoryIcon(iconName: string): string {
    const normalizedName = iconName?.trim();
    if (!normalizedName) {
      return 'pricetag-outline';
    }

    return this.registeredIconNames.has(normalizedName) ? normalizedName : 'pricetag-outline';
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

  async loadCategories(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      this.categories = await this.categoryRepository.getCategoriesForSettings();
      this.registerIconsFromCategories(this.categories);
    } catch (error) {
      console.error('Error loading categories for management:', error);
      this.error = 'Failed to load categories';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async syncCategories(): Promise<void> {
    if (!this.syncEnabled) {
      return;
    }

    const accessToken = this.sessionService.currentSession?.accessToken;
    const spreadsheetId = this.sessionService.linkedSpreadsheet?.id;

    if (!accessToken || !spreadsheetId) {
      return;
    }

    try {
      this.syncing = true;
      this.error = null;
      this.cdr.markForCheck();

      await this.googleSheetService.syncCategories(accessToken, spreadsheetId);
      await this.loadCategories();
      await this.presentToast('Categories synced successfully', 'success');
    } catch (error) {
      console.error('Error syncing categories:', error);
      this.error = 'Failed to sync categories';
      await this.presentToast('Failed to sync categories', 'danger');
    } finally {
      this.syncing = false;
      this.cdr.markForCheck();
    }
  }

  async openEditModal(category: Category): Promise<void> {
    const modal = await this.modalController.create({
      component: CategoryEditModalComponent,
      componentProps: {
        category
      }
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss<CategoryEditModalResult>();
    if (role !== 'save' || !data) {
      return;
    }

    try {
      this.error = null;
      this.categories = this.categories.map((currentCategory) => {
        if (currentCategory.id !== category.id) {
          return currentCategory;
        }

        return {
          ...currentCategory,
          name: data.name,
          icon: data.icon,
          color: data.color,
          isDeleted: !data.isActive
        };
      });
      this.registerIconsFromCategories(this.categories);
      this.cdr.markForCheck();

      const wasActive = !category.isDeleted;
      const willBeActive = data.isActive;

      await this.categoryRepository.updateCategory(category.id, {
        name: data.name,
        icon: data.icon,
        color: data.color
      });

      if (wasActive !== willBeActive) {
        await this.categoryRepository.setCategoryIsActive(category.id, willBeActive);
      }

      await this.loadCategories();
    } catch (error) {
      console.error('Error saving category changes:', error);
      this.error = 'Failed to save category changes';
      await this.loadCategories();
      this.cdr.markForCheck();
    }
  }

  async openCreateModal(): Promise<void> {
    const draftCategory: Partial<Category> = {
      name: '',
      icon: this.categoryDefaultIcon,
      color: this.getRandomCategoryColor(),
      isDeleted: false
    };

    const modal = await this.modalController.create({
      component: CategoryEditModalComponent,
      componentProps: {
        category: draftCategory
      }
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss<CategoryEditModalResult>();
    if (role !== 'save' || !data) {
      return;
    }

    try {
      this.error = null;
      const icon = data.icon || this.categoryDefaultIcon;
      const color = data.color || draftCategory.color || this.getRandomCategoryColor();

      const newCategory = await this.categoryRepository.createCategory({
        name: data.name,
        icon,
        color
      });

      this.categories = [...this.categories, newCategory];
      this.registerIconsFromCategories([newCategory]);
      this.cdr.markForCheck();

      await this.loadCategories();
    } catch (error) {
      console.error('Error creating category:', error);
      this.error = 'Failed to create category';
      this.cdr.markForCheck();
    }
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
