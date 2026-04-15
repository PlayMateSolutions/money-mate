import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonMenuButton,
  IonList,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonNote,
  IonIcon,
  IonSpinner,
  IonBadge,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { syncOutline, pricetagOutline, swapHorizontalOutline } from 'ionicons/icons';
import { Account, Category, Transaction } from '../core/database/models';
import { AccountRepository, CategoryRepository, TransactionRepository } from '../core/database/repositories';
import {
  buildTransactionDisplayItem,
  GoogleSheetService,
  registerCategoryIcons,
  SessionService,
  TransactionDisplayItem,
} from '../core/services';
import { TransactionFormModalComponent } from './components/transaction-form-modal.component';

interface TransactionListItem extends TransactionDisplayItem {
  dateKey: string;
}

interface TransactionDateGroup {
  dateKey: string;
  dateLabel: string;
  items: TransactionListItem[];
}

@Component({
  selector: 'app-transactions',
  templateUrl: 'transactions.page.html',
  styleUrls: ['transactions.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonMenuButton,
    IonList,
    IonItem,
    IonItemDivider,
    IonLabel,
    IonNote,
    IonIcon,
    IonSpinner,
    IonBadge,
  ]
})
export class TransactionsPage implements OnInit, OnDestroy {
  private readonly CURRENCY_KEY = 'money-mate-currency';
  selectedCurrency = 'USD';
  loading = true;
  syncing = false;
  error: string | null = null;
  groupedItems: TransactionDateGroup[] = [];
  private accountsMap = new Map<string, Account>();
  private categoriesMap = new Map<string, Category>();
  private transactionsSub?: Subscription;
  private registeredIconNames = new Set<string>([
    'pricetag-outline',
    'swap-horizontal-outline'
  ]);

  constructor(
    private transactionRepository: TransactionRepository,
    private accountRepository: AccountRepository,
    private categoryRepository: CategoryRepository,
    private readonly sessionService: SessionService,
    private readonly googleSheetService: GoogleSheetService,
    private readonly toastController: ToastController,
    private readonly modalController: ModalController,
  ) {
    addIcons({
      pricetagOutline,
      swapHorizontalOutline,
      syncOutline,
    });
  }

  ngOnInit(): void {
    this.loadSelectedCurrency();
    void this.initializeTransactionsStream();
  }

  ngOnDestroy(): void {
    this.transactionsSub?.unsubscribe();
  }

  async ionViewWillEnter(): Promise<void> {
    this.loadSelectedCurrency();
    await this.refreshLookups();
    await this.transactionRepository.getAllTransactions();
  }

  get hasTransactions(): boolean {
    return this.groupedItems.length > 0;
  }

  get hasDirtyTransactions(): boolean {
    return this.groupedItems.some((group) => group.items.some((item) => !!item.transaction.isDirty));
  }

  get canSync(): boolean {
    return !!this.sessionService.currentSession?.accessToken && !!this.sessionService.linkedSpreadsheet?.id;
  }

  trackByDateGroup(_: number, group: TransactionDateGroup): string {
    return group.dateKey;
  }

  trackByTransactionId(_: number, item: TransactionListItem): string {
    return item.id;
  }

  getDisplayAmount(amount: number): number {
    return Math.abs(amount);
  }

  private loadSelectedCurrency(): void {
    this.selectedCurrency = localStorage.getItem(this.CURRENCY_KEY) || 'USD';
  }

  getTransferSubtitle(item: TransactionListItem): string {
    return `${item.accountName} → ${item.transferToAccountName ?? 'Unknown account'}`;
  }

  async openEditModal(item: TransactionListItem): Promise<void> {
    const modal = await this.modalController.create({
      component: TransactionFormModalComponent,
      componentProps: { transactionToEdit: item.transaction },
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'saved') {
      await this.refreshLookups();
    }
  }

  async syncTransactions(): Promise<void> {
    if (this.syncing) {
      return;
    }

    if (!this.sessionService.currentSession?.accessToken || !this.sessionService.linkedSpreadsheet?.id) {
      return;
    }

    try {
      this.syncing = true;
      this.error = null;

      await this.googleSheetService.syncTransactions();
      await this.refreshLookups();
      await this.transactionRepository.getAllTransactions();
      await this.presentToast('Transactions synced successfully', 'success');
    } catch (error) {
      console.error('Error syncing transactions:', error);
      this.error = 'Failed to sync transactions';
      await this.presentToast('Failed to sync transactions', 'danger');
    } finally {
      this.syncing = false;
    }
  }

  private getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getDateLabel(date: Date): string {
    const today = new Date();
    const todayKey = this.getDateKey(today);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = this.getDateKey(yesterday);

    const dateKey = this.getDateKey(date);
    if (dateKey === todayKey) {
      return 'Today';
    }

    if (dateKey === yesterdayKey) {
      return 'Yesterday';
    }

    return date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  private async initializeTransactionsStream(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;

      await this.refreshLookups();
      this.transactionsSub = this.transactionRepository.getTransactions$().subscribe({
        next: (transactions) => {
          this.error = null;
          this.buildGroupedItems(transactions);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error in transactions stream:', error);
          this.error = 'Failed to load transactions';
          this.groupedItems = [];
          this.loading = false;
        }
      });
    } catch (error) {
      console.error('Error initializing transactions stream:', error);
      this.error = 'Failed to load transactions';
      this.groupedItems = [];
      this.loading = false;
    }
  }

  private async refreshLookups(): Promise<void> {
    const [accounts, categories] = await Promise.all([
      this.accountRepository.getAccountsForSettings(),
      this.categoryRepository.getCategoriesForSettings()
    ]);

    this.accountsMap = new Map<string, Account>(accounts.map(account => [account.id, account]));
    this.categoriesMap = new Map<string, Category>(categories.map(category => [category.id, category]));
    registerCategoryIcons(categories, this.registeredIconNames);
  }

  private buildGroupedItems(transactions: Transaction[]): void {
    const groupedMap = new Map<string, TransactionDateGroup>();

    transactions.forEach((transaction) => {
      const date = new Date(transaction.date);
      const dateKey = this.getDateKey(date);

      if (!groupedMap.has(dateKey)) {
        groupedMap.set(dateKey, {
          dateKey,
          dateLabel: this.getDateLabel(date),
          items: []
        });
      }

      const item: TransactionListItem = {
        ...buildTransactionDisplayItem(
          transaction,
          this.accountsMap,
          this.categoriesMap,
          this.registeredIconNames,
        ),
        dateKey
      };

      groupedMap.get(dateKey)?.items.push(item);
    });

    this.groupedItems = Array.from(groupedMap.values()).sort(
      (a, b) => new Date(b.dateKey).getTime() - new Date(a.dateKey).getTime()
    );
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
