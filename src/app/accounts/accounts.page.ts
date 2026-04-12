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
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  createOutline,
  pricetagOutline,
  add
} from 'ionicons/icons';
import * as ionicons from 'ionicons/icons';
import { Account } from '../core/database/models';
import { AccountRepository } from '../core/database/repositories';
import { AccountEditModalComponent, AccountEditModalResult } from './components/account-edit-modal.component';

@Component({
  selector: 'app-accounts',
  templateUrl: './accounts.page.html',
  styleUrls: ['./accounts.page.scss'],
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
export class AccountsPage implements OnInit {
  accounts: Account[] = [];
  loading = true;
  error: string | null = null;
  private registeredIconNames = new Set<string>(['create-outline', 'pricetag-outline']);

  private readonly accountTypeDefaults: Record<Account['type'], { color: string; icon: string }> = {
    cash: { color: '#FFB300', icon: 'cash-outline' },
    checking: { color: '#4CAF50', icon: 'card-outline' },
    savings: { color: '#2196F3', icon: 'wallet-outline' },
    credit: { color: '#9C27B0', icon: 'card-outline' }
  };

  constructor(
    private accountRepository: AccountRepository,
    private modalController: ModalController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      createOutline,
      pricetagOutline,
      add
    });
  }

  ngOnInit(): void {
    this.loadAccounts();
  }

  get activeAccounts(): Account[] {
    return this.accounts.filter(account => !account.isDeleted);
  }

  get inactiveAccounts(): Account[] {
    return this.accounts.filter(account => account.isDeleted);
  }

  trackByAccountId(_: number, account: Account): string {
    return account.id;
  }

  getAccountIcon(iconName: string): string {
    const normalizedName = iconName?.trim();
    if (!normalizedName) {
      return 'pricetag-outline';
    }

    return this.registeredIconNames.has(normalizedName) ? normalizedName : 'pricetag-outline';
  }

  private registerIconsFromAccounts(accounts: Account[]): void {
    const iconsToRegister: Record<string, string> = {};

    accounts.forEach((account) => {
      const iconName = account.icon?.trim();
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

  async loadAccounts(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      this.accounts = await this.accountRepository.getAccountsForSettings();
      this.registerIconsFromAccounts(this.accounts);
    } catch (error) {
      console.error('Error loading accounts for management:', error);
      this.error = 'Failed to load accounts';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async openEditModal(account: Account): Promise<void> {
    const modal = await this.modalController.create({
      component: AccountEditModalComponent,
      componentProps: {
        account
      }
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss<AccountEditModalResult>();
    if (role !== 'save' || !data) {
      return;
    }

    try {
      this.error = null;
      this.accounts = this.accounts.map((currentAccount) => {
        if (currentAccount.id !== account.id) {
          return currentAccount;
        }

        return {
          ...currentAccount,
          name: data.name,
          type: data.type,
          ownerName: data.ownerName,
          color: data.color,
          icon: data.icon,
          isDeleted: !data.isActive,
          updatedAt: new Date()
        };
      });
      this.registerIconsFromAccounts(this.accounts);
      this.cdr.markForCheck();

      const wasActive = !account.isDeleted;
      const willBeActive = data.isActive;

      // Optimistic update for regular fields
      this.accounts = this.accounts.map((current) =>
        current.id === account.id
          ? { ...current, name: data.name, type: data.type, ownerName: data.ownerName, color: data.color, icon: data.icon, updatedAt: new Date() }
          : current
      );
      this.cdr.markForCheck();

      // Optimistic update for isDeleted if state changed
      if (wasActive !== willBeActive) {
        this.accounts = this.accounts.map((current) =>
          current.id === account.id
            ? { ...current, isDeleted: !willBeActive }
            : current
        );
        this.cdr.markForCheck();
      }

      await this.accountRepository.updateAccount(account.id, {
        name: data.name,
        type: data.type,
        ownerName: data.ownerName,
        color: data.color,
        icon: data.icon
      });

      if (wasActive !== willBeActive) {
        await this.accountRepository.setAccountIsActive(account.id, willBeActive);
      }

      await this.loadAccounts();
    } catch (error) {
      console.error('Error saving account changes:', error);
      this.error = 'Failed to save account changes';
      await this.loadAccounts();
      this.cdr.markForCheck();
    }
  }

  async openCreateModal(): Promise<void> {
    const draftAccount: Partial<Account> = {
      name: '',
      type: 'savings',
      ownerName: '',
      color: this.accountTypeDefaults['savings'].color,
      icon: this.accountTypeDefaults['savings'].icon,
      isDeleted: false
    };

    const modal = await this.modalController.create({
      component: AccountEditModalComponent,
      componentProps: { account: draftAccount }
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss<AccountEditModalResult>();
    if (role !== 'save' || !data) {
      return;
    }

    try {
      this.error = null;
      const defaults = this.accountTypeDefaults[data.type];
      const newAccount = await this.accountRepository.createAccount({
        name: data.name,
        type: data.type,
        ownerName: data.ownerName || 'Me',
        color: data.color || defaults.color,
        icon: data.icon || defaults.icon,
        balance: 0,
        notes: ''
      });

      this.accounts = [...this.accounts, newAccount];
      this.registerIconsFromAccounts([newAccount]);
      this.cdr.markForCheck();

      await this.loadAccounts();
    } catch (error) {
      console.error('Error creating account:', error);
      this.error = 'Failed to create account';
      this.cdr.markForCheck();
    }
  }
}
