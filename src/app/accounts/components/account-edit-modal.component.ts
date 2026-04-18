import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonIcon,
  IonToggle,
  IonSelect,
  IonSelectOption,
  ModalController
} from '@ionic/angular/standalone';
import { Account, AccountType } from '../../core/database/models';
import { IconPickerModalComponent } from '../../shared/icon-picker/icon-picker-modal.component';
import { IconPickerConfig, IconPickerResult } from '../../shared/icon-picker/icon-picker.types';

export interface AccountEditModalResult {
  name: string;
  type: AccountType;
  balance: number;
  ownerName: string;
  color: string;
  icon: string;
  isActive: boolean;
}

@Component({
  selector: 'app-account-edit-modal',
  templateUrl: './account-edit-modal.component.html',
  styleUrls: ['./account-edit-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonIcon,
    IonToggle,
    IonSelect,
    IonSelectOption
  ]
})
export class AccountEditModalComponent implements OnInit {
  @Input() account?: Partial<Account>;

  readonly iconPickerConfig: Partial<IconPickerConfig> = {
    sourceUrl: 'assets/assets/ionic-icons.json',
    initialVisibleCount: 100,
    loadMoreStep: 100,
    title: 'Pick Icon',
    searchPlaceholder: 'Search icon by name or tag'
  };

  form: AccountEditModalResult = {
    name: '',
    type: 'savings',
    balance: 0,
    ownerName: '',
    color: '',
    icon: '',
    isActive: true
  };

  constructor(private modalController: ModalController) {}

  ngOnInit(): void {
    if (this.account?.id) {
      this.form = {
        name: this.account.name ?? '',
        type: this.account.type ?? 'savings',
        balance: this.normalizeBalance(this.account.balance),
        ownerName: this.account.ownerName ?? '',
        color: this.normalizeColor(this.account.color ?? ''),
        icon: this.account.icon ?? this.getDefaultIcon(this.account.type),
        isActive: !this.account.isDeleted
      };
      return;
    }

    this.form = {
      name: this.account?.name ?? '',
      type: this.account?.type ?? 'savings',
      balance: this.normalizeBalance(this.account?.balance),
      ownerName: this.account?.ownerName ?? '',
      color: this.normalizeColor(this.account?.color ?? '') || this.generateRandomColor(),
      icon: this.account?.icon ?? this.getDefaultIcon(this.account?.type),
      isActive: this.account?.isDeleted !== undefined ? !this.account.isDeleted : true
    };
  }

  private generateRandomColor(): string {
    return ('#' + ((Math.random() * 0xFFFFFF) << 0).toString(16).padStart(6, '0')).toUpperCase();
  }

  private normalizeColor(value: string): string {
    return value.trim().toUpperCase();
  }

  private normalizeBalance(value: number | string | null | undefined): number {
    const normalizedValue = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(normalizedValue) ? normalizedValue : 0;
  }

  private getDefaultIcon(type: AccountType | null | undefined): string {
    switch (type) {
      case 'cash':
        return 'cash-outline';
      case 'credit':
        return 'card-outline';
      case 'checking':
        return 'card-outline';
      case 'savings':
      default:
        return 'wallet-outline';
    }
  }

  onBalanceChange(value: string | number | null | undefined): void {
    this.form.balance = this.normalizeBalance(value);
  }

  async openIconPicker(): Promise<void> {
    const modal = await this.modalController.create({
      component: IconPickerModalComponent,
      componentProps: {
        selectedIcon: this.form.icon,
        selectedColor: this.form.color,
        config: this.iconPickerConfig
      },
      breakpoints: [0, 0.75, 1],
      initialBreakpoint: 0.75
    });

    await modal.present();
    const { data, role } = await modal.onDidDismiss<IconPickerResult>();

    if (role !== 'select' || !data?.icon) {
      return;
    }

    this.form.icon = data.icon;
    if (data.color) {
      this.form.color = this.normalizeColor(data.color);
    }
  }

  get canSave(): boolean {
    return this.form.name.trim().length > 0;
  }

  async cancel(): Promise<void> {
    await this.modalController.dismiss(undefined, 'cancel');
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      return;
    }

    await this.modalController.dismiss(
      {
        name: this.form.name.trim(),
        type: this.form.type,
        balance: this.form.balance,
        ownerName: this.form.ownerName.trim(),
        color: this.normalizeColor(this.form.color),
        icon: (this.form.icon || this.getDefaultIcon(this.form.type)).trim(),
        isActive: this.form.isActive
      },
      'save'
    );
  }
}
