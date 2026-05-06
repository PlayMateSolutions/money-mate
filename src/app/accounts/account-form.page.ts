import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { createOutline, walletOutline } from 'ionicons/icons';
import { Account, AccountType } from '../core/database/models';
import { AccountRepository } from '../core/database/repositories';
import { IconPickerModalComponent } from '../shared/icon-picker/icon-picker-modal.component';
import { IconPickerConfig, IconPickerResult } from '../shared/icon-picker/icon-picker.types';

interface AccountFormValue {
  name: string;
  type: AccountType;
  balance: number;
  ownerName: string;
  color: string;
  icon: string;
  isActive: boolean;
}

@Component({
  selector: 'app-account-form',
  standalone: true,
  templateUrl: './account-form.page.html',
  styleUrls: ['./account-form.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTitle,
    IonToggle,
    IonToolbar
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountFormPage implements OnInit {
  readonly iconPickerConfig: Partial<IconPickerConfig> = {
    sourceUrl: 'assets/assets/ionic-icons.json',
    initialVisibleCount: 100,
    loadMoreStep: 100,
    title: 'Pick Icon',
    searchPlaceholder: 'Search icon by name or tag'
  };

  private readonly accountTypeDefaults: Record<Account['type'], { color: string; icon: string }> = {
    cash: { color: '#FFB300', icon: 'cash-outline' },
    checking: { color: '#4CAF50', icon: 'card-outline' },
    savings: { color: '#2196F3', icon: 'wallet-outline' },
    credit: { color: '#9C27B0', icon: 'card-outline' }
  };

  loading = true;
  saving = false;
  error: string | null = null;
  account?: Account;

  form: AccountFormValue = {
    name: '',
    type: 'savings',
    balance: 0,
    ownerName: '',
    color: '',
    icon: 'wallet-outline',
    isActive: true
  };

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    private readonly modalController: ModalController,
    private readonly toastController: ToastController,
    private readonly accountRepository: AccountRepository,
    private readonly cdr: ChangeDetectorRef
  ) {
    addIcons({ createOutline, walletOutline });
  }

  get isEditMode(): boolean {
    return !!this.account;
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Edit Account' : 'Create Account';
  }

  get canSave(): boolean {
    return !this.loading && !this.saving && this.form.name.trim().length > 0;
  }

  async ngOnInit(): Promise<void> {
    await this.loadAccount();
  }

  private async loadAccount(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;

      const accountId = this.activatedRoute.snapshot.paramMap.get('id');
      if (!accountId) {
        this.initializeCreateForm();
        return;
      }

      const currentNavigation = this.router.getCurrentNavigation();
      const accountFromNavigation = currentNavigation?.extras.state?.['account'] as Account | undefined;
      const accountFromHistory = history.state?.account as Account | undefined;
      const stateAccount = accountFromNavigation?.id === accountId
        ? accountFromNavigation
        : accountFromHistory?.id === accountId
          ? accountFromHistory
          : undefined;

      if (stateAccount) {
        this.account = stateAccount;
        this.form = {
          name: stateAccount.name ?? '',
          type: stateAccount.type ?? 'savings',
          balance: this.normalizeBalance(stateAccount.balance),
          ownerName: stateAccount.ownerName ?? '',
          color: this.normalizeColor(stateAccount.color ?? ''),
          icon: stateAccount.icon ?? this.getDefaultIcon(stateAccount.type),
          isActive: !stateAccount.isDeleted
        };
        return;
      }

      const account = await this.accountRepository.getAccountByIdForSettings(accountId);
      if (!account) {
        this.error = 'Account not found';
        return;
      }

      this.account = account;
      this.form = {
        name: account.name ?? '',
        type: account.type ?? 'savings',
        balance: this.normalizeBalance(account.balance),
        ownerName: account.ownerName ?? '',
        color: this.normalizeColor(account.color ?? ''),
        icon: account.icon ?? this.getDefaultIcon(account.type),
        isActive: !account.isDeleted
      };
    } catch (error) {
      console.error('Error loading account form:', error);
      this.error = 'Failed to load account';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private initializeCreateForm(): void {
    const defaults = this.accountTypeDefaults['savings'];
    this.account = undefined;
    this.form = {
      name: '',
      type: 'savings',
      balance: 0,
      ownerName: '',
      color: defaults.color,
      icon: defaults.icon,
      isActive: true
    };
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
    this.cdr.markForCheck();
  }

  async cancel(): Promise<void> {
    await this.router.navigate(['/settings/accounts']);
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      return;
    }

    const defaults = this.accountTypeDefaults[this.form.type];
    const payload = {
      name: this.form.name.trim(),
      type: this.form.type,
      balance: this.normalizeBalance(this.form.balance),
      ownerName: this.form.ownerName.trim() || 'Me',
      color: this.normalizeColor(this.form.color) || defaults.color,
      icon: (this.form.icon || defaults.icon).trim(),
    };

    try {
      this.saving = true;
      this.error = null;
      this.cdr.markForCheck();

      if (this.account) {
        await this.accountRepository.updateAccount(this.account.id, payload);

        const wasActive = !this.account.isDeleted;
        if (wasActive !== this.form.isActive) {
          await this.accountRepository.setAccountIsActive(this.account.id, this.form.isActive);
        }

        await this.presentToast('Account updated', 'success');
      } else {
        await this.accountRepository.createAccount({
          ...payload,
          notes: ''
        });
        await this.presentToast('Account created', 'success');
      }

      await this.router.navigate(['/settings/accounts']);
    } catch (error) {
      console.error('Error saving account:', error);
      this.error = this.account ? 'Failed to save account changes' : 'Failed to create account';
      await this.presentToast(this.error, 'danger');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  private async presentToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}