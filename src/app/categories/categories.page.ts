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
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  createOutline,
  pricetagOutline,
  add,
  syncOutline,
} from 'ionicons/icons';
import * as ionicons from 'ionicons/icons';
import { Category } from '../core/database/models';
import { CategoryRepository } from '../core/database/repositories';
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
    private router: Router,
    private cdr: ChangeDetectorRef,
    private readonly sessionService: SessionService,
    private readonly googleSheetService: GoogleSheetService,
    private readonly toastController: ToastController,
  ) {
    addIcons({
      createOutline,
      pricetagOutline,
      add,
      syncOutline,
    });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  ionViewWillEnter(): void {
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
  async openEditPage(category: Category): Promise<void> {
    await this.router.navigate(['/settings/categories', category.id], {
      state: {
        category
      }
    });
  }

  async openCreatePage(): Promise<void> {
    await this.router.navigate(['/settings/categories/new']);
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
