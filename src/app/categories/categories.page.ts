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
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  createOutline,
  pricetagOutline,
} from 'ionicons/icons';
import * as ionicons from 'ionicons/icons';
import { Category } from '../core/database/models';
import { CategoryRepository } from '../core/database/repositories';
import { CategoryEditModalComponent, CategoryEditModalResult } from './components/category-edit-modal.component';

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
    IonSpinner
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoriesPage implements OnInit {
  categories: Category[] = [];
  loading = true;
  error: string | null = null;
  private registeredIconNames = new Set<string>(['create-outline', 'pricetag-outline']);

  constructor(
    private categoryRepository: CategoryRepository,
    private modalController: ModalController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      createOutline,
      pricetagOutline
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

  trackByCategoryId(_: number, category: Category): string {
    return category.id;
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
          isDeleted: !data.isActive,
          updatedAt: new Date()
        };
      });
      this.registerIconsFromCategories(this.categories);
      this.cdr.markForCheck();

      await this.categoryRepository.updateCategory(category.id, {
        name: data.name,
        icon: data.icon,
        color: data.color,
        isDeleted: !data.isActive
      });

      await this.loadCategories();
    } catch (error) {
      console.error('Error saving category changes:', error);
      this.error = 'Failed to save category changes';
      await this.loadCategories();
      this.cdr.markForCheck();
    }
  }
}
