import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import * as ionicons from 'ionicons/icons';
import { pricetagOutline } from 'ionicons/icons';
import { Category } from '../../core/database/models';

@Component({
  selector: 'app-category-grid-selector',
  standalone: true,
  imports: [CommonModule, IonIcon],
  templateUrl: './category-grid-selector.component.html',
  styleUrls: ['./category-grid-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryGridSelectorComponent implements OnChanges {
  @Input() categories: Category[] = [];
  @Input() selectedCategoryIds: string[] = [];
  @Input() includeUncategorized = true;
  @Input() uncategorizedLabel = 'Uncategorized';

  @Output() selectedCategoryIdsChange = new EventEmitter<string[]>();

  readonly uncategorizedId = '__uncategorized__';
  private readonly defaultIcon = 'pricetag-outline';
  private readonly registeredIconNames = new Set<string>([this.defaultIcon]);
  private selectedCategoryIdSet = new Set<string>();

  constructor() {
    addIcons({ pricetagOutline });
  }

  ngOnChanges(): void {
    this.selectedCategoryIdSet = new Set(this.selectedCategoryIds);
    this.registerCategoryIcons(this.categories);
  }

  trackByCategoryId(_: number, category: Category): string {
    return category.id;
  }

  isSelected(categoryId: string): boolean {
    return this.selectedCategoryIdSet.has(categoryId);
  }

  toggleCategory(categoryId: string): void {
    if (this.isSelected(categoryId)) {
      this.selectedCategoryIdSet.delete(categoryId);
      this.selectedCategoryIdsChange.emit([...this.selectedCategoryIdSet]);
      return;
    }

    this.selectedCategoryIdSet.add(categoryId);
    this.selectedCategoryIdsChange.emit([...this.selectedCategoryIdSet]);
  }

  getCategoryIcon(iconName?: string): string {
    const normalizedName = iconName?.trim();
    if (!normalizedName) {
      return this.defaultIcon;
    }

    return this.registeredIconNames.has(normalizedName) ? normalizedName : this.defaultIcon;
  }

  getCategoryColor(color?: string): string {
    const normalizedColor = color?.trim();
    return normalizedColor || 'var(--ion-color-medium)';
  }

  private registerCategoryIcons(categories: Category[]): void {
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
