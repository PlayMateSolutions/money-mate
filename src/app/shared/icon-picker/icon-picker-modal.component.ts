import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonSegment,
  IonSegmentButton,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import * as ionicons from 'ionicons/icons';
import { IconColorPickerComponent } from './components/icon-color-picker.component';
import {
  DEFAULT_ICON_PICKER_CONFIG,
  IconPickerConfig,
  IconPickerDataSource,
  IconPickerIcon,
  IconPickerResult
} from './icon-picker.types';

@Component({
  selector: 'app-icon-picker-modal',
  standalone: true,
  templateUrl: './icon-picker-modal.component.html',
  styleUrls: ['./icon-picker-modal.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSearchbar,
    IonIcon,
    IonSpinner,
    IconColorPickerComponent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonSegment,
    IonSegmentButton
  ]
})
export class IconPickerModalComponent implements OnInit {
  @Input() selectedIcon = '';
  @Input() selectedColor = '#2196F3';
  @Input() config: Partial<IconPickerConfig> = {};

  mergedConfig: IconPickerConfig = DEFAULT_ICON_PICKER_CONFIG;
  loading = false;
  error = '';
  searchQuery = '';

  iconStyle: 'outline' | 'filled' | 'sharp' = 'outline';

  allIcons: IconPickerIcon[] = [];
  filteredIcons: IconPickerIcon[] = [];
  visibleIcons: IconPickerIcon[] = [];
  visibleCount = 0;
  selectedIconName = '';
  currentColor = '#2196F3';

  private readonly registeredIconNames = new Set<string>();

  constructor(
    private readonly modalController: ModalController,
    private readonly http: HttpClient
  ) {}

  async ngOnInit(): Promise<void> {
    this.mergedConfig = {
      ...DEFAULT_ICON_PICKER_CONFIG,
      ...this.config
    };

    this.selectedIconName = this.selectedIcon?.trim() || '';
    this.currentColor = this.normalizeColor(this.selectedColor) || '#2196F3';

    await this.loadIcons();
  }

  get hasMore(): boolean {
    return this.visibleCount < this.filteredIcons.length;
  }

  async cancel(): Promise<void> {
    await this.modalController.dismiss(undefined, 'cancel');
  }

  async select(): Promise<void> {
    if (!this.selectedIconName) {
      return;
    }

    const result: IconPickerResult = {
      icon: this.selectedIconName,
      color: this.currentColor
    };

    await this.modalController.dismiss(result, 'select');
  }

  onSearchChange(value: string | null | undefined): void {
    this.searchQuery = String(value ?? '').trim().toLowerCase();
    this.applyFilters();
  }

  onIconStyleChange(event: any): void {
    this.applyFilters();
  }

  onInfiniteScroll(event: any): void {
    this.loadMore();
    setTimeout(() => {
      event.target.complete();
    }, 350);
  }
  
  loadMore(): void {
    if (!this.hasMore) {
      return;
    }

    this.visibleCount = Math.min(
      this.visibleCount + this.mergedConfig.loadMoreStep,
      this.filteredIcons.length
    );
    this.refreshVisibleIcons();
  }

  chooseIcon(iconName: string): void {
    this.selectedIconName = iconName;
  }

  onColorChange(color: string): void {
    this.currentColor = this.normalizeColor(color) || this.currentColor;
  }

  private async loadIcons(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      const data = await this.http
        .get<IconPickerDataSource>(this.mergedConfig.sourceUrl)
        .toPromise();

      this.allIcons = Array.isArray(data?.icons)
        ? data.icons.filter((icon) => !!icon?.name)
        : [];
      this.applyFilters();
    } catch (error) {
      this.error = 'Failed to load icons.';
      this.allIcons = [];
      this.filteredIcons = [];
      this.visibleIcons = [];
      this.visibleCount = 0;
      console.error('Icon picker load error:', error);
    } finally {
      this.loading = false;
    }
  }

  private applyFilters(): void {
    // Filter by search
    let icons = !this.searchQuery
      ? [...this.allIcons]
      : this.allIcons.filter((icon) => {
          const nameMatch = icon.name.toLowerCase().includes(this.searchQuery);
          const tagsMatch = icon.tags?.some((tag) =>
            tag.toLowerCase().includes(this.searchQuery)
          );
          return nameMatch || !!tagsMatch;
        });

    // Filter by style
    if (this.iconStyle === 'outline') {
      icons = icons.filter(icon => icon.name.endsWith('-outline'));
    } else if (this.iconStyle === 'sharp') {
      icons = icons.filter(icon => icon.name.endsWith('-sharp'));
    } else if (this.iconStyle === 'filled') {
      icons = icons.filter(icon =>
        !icon.name.endsWith('-outline') && !icon.name.endsWith('-sharp')
      );
    }

    this.filteredIcons = icons;
    this.visibleCount = Math.min(
      this.mergedConfig.initialVisibleCount,
      this.filteredIcons.length
    );
    this.refreshVisibleIcons();
  }

  private refreshVisibleIcons(): void {
    this.visibleIcons = this.filteredIcons.slice(0, this.visibleCount);
    this.registerIcons(this.visibleIcons.map((icon) => icon.name));
  }

  private registerIcons(iconNames: string[]): void {
    const iconsToRegister: Record<string, string> = {};

    iconNames.forEach((iconName) => {
      const normalizedIconName = iconName.trim();
      if (!normalizedIconName || this.registeredIconNames.has(normalizedIconName)) {
        return;
      }

      const exportName = normalizedIconName.replace(/-([a-z])/g, (_, char: string) =>
        char.toUpperCase()
      );
      const iconData = (ionicons as Record<string, string>)[exportName];
      if (!iconData) {
        return;
      }

      iconsToRegister[normalizedIconName] = iconData;
      this.registeredIconNames.add(normalizedIconName);
    });

    if (Object.keys(iconsToRegister).length > 0) {
      addIcons(iconsToRegister);
    }
  }

  private normalizeColor(value: string): string {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) {
      return '';
    }

    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return /^#([0-9A-F]{3}|[0-9A-F]{6})$/.test(normalized) ? normalized : '';
  }
}
