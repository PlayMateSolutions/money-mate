import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  IonFab,
  IonFabButton,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { syncOutline, pricetagOutline, swapHorizontalOutline, filterOutline, flashOutline } from 'ionicons/icons';
import { Account, Category, Transaction, TransactionType } from '../core/database/models';
import { AccountRepository, CategoryRepository, TransactionRepository } from '../core/database/repositories';
import {
  buildTransactionDisplayItem,
  GoogleSheetService,
  registerCategoryIcons,
  SessionService,
  TransactionDisplayItem,
} from '../core/services';
import { Router } from '@angular/router';
import { TransactionFilterModalComponent, TransactionFilterState } from './components/transaction-filter-modal.component';
import { DateRangeFilterComponent, DateRange } from '../shared/date-range-filter/date-range-filter.component';

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
    IonFab,
    IonFabButton,
    RouterLink,
    DateRangeFilterComponent,
  ]
})
export class TransactionsPage implements OnInit, OnDestroy {
  private readonly CURRENCY_KEY = 'money-mate-currency';
  private readonly allTransactionTypes: TransactionType[] = ['expense', 'income', 'transfer'];
  selectedCurrency = 'USD';
  loading = true;
  syncing = false;
  error: string | null = null;
  groupedItems: TransactionDateGroup[] = [];
  totalTransactions = 0;
  availableTags: string[] = [];
  private allTransactions: Transaction[] = [];
  private accountsMap = new Map<string, Account>();
  private categoriesMap = new Map<string, Category>();
  private accounts: Account[] = [];
  private categories: Category[] = [];
  private transactionsSub?: Subscription;
  private registeredIconNames = new Set<string>([
    'pricetag-outline',
    'swap-horizontal-outline'
  ]);
  filters: TransactionFilterState = this.getDefaultFilters();
  selectedDateRange: DateRange = this.getDefaultDateRange();

  constructor(
    private transactionRepository: TransactionRepository,
    private accountRepository: AccountRepository,
    private categoryRepository: CategoryRepository,
    private readonly sessionService: SessionService,
    private readonly googleSheetService: GoogleSheetService,
    private readonly toastController: ToastController,
    private readonly modalController: ModalController,
    private readonly router: Router,
  ) {
    addIcons({
      pricetagOutline,
      swapHorizontalOutline,
      syncOutline,
      filterOutline,
      flashOutline,
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
    this.resetFilters();
    await this.refreshLookups();
    await this.transactionRepository.getAllTransactions();
  }

  ionViewWillLeave(): void {
    this.resetFilters();
    this.selectedDateRange = this.getDefaultDateRange();
  }

  get hasTransactions(): boolean {
    return this.groupedItems.length > 0;
  }

  get filteredTransactionsCount(): number {
    return this.groupedItems.reduce((total, group) => total + group.items.length, 0);
  }

  get activeFilterCount(): number {
    let count = 0;

    if (this.filters.types.length !== this.allTransactionTypes.length) {
      count += 1;
    }

    if (this.filters.categoryIds.length > 0) {
      count += 1;
    }

    if (this.filters.accountIds.length > 0) {
      count += 1;
    }

    if (this.filters.tags.length > 0) {
      count += 1;
    }

    return count;
  }

  get hasActiveFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  get emptyStateMessage(): string {
    if (this.hasActiveFilters && this.totalTransactions > 0) {
      return 'No transactions match your filters';
    }

    return 'No transactions yet';
  }

  get hasDirtyTransactions(): boolean {
    return this.allTransactions.some((transaction) => !!transaction.isDirty);
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

  onDateRangeChange(dateRange: DateRange): void {
    this.selectedDateRange = dateRange;
    this.buildGroupedItems(this.applyFilters(this.allTransactions));
  }

  async openEditModal(item: TransactionListItem): Promise<void> {
    await this.router.navigate(['/tabs/transactions/form', item.id]);
  }

  async openFilterModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: TransactionFilterModalComponent,
      componentProps: {
        initialFilters: this.filters,
        accounts: this.accounts,
        categories: this.categories,
        availableTags: this.availableTags,
      },
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss<TransactionFilterState>();

    if (role !== 'apply' || !data) {
      return;
    }

    this.filters = {
      types: [...data.types],
      categoryIds: [...data.categoryIds],
      accountIds: [...data.accountIds],
      tags: [...data.tags],
    };

    this.buildGroupedItems(this.applyFilters(this.allTransactions));
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
          this.allTransactions = transactions;
          this.totalTransactions = transactions.length;
          this.updateAvailableTags(transactions);
          this.buildGroupedItems(this.applyFilters(transactions));
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

    this.accounts = accounts;
    this.categories = categories;

    this.accountsMap = new Map<string, Account>(accounts.map(account => [account.id, account]));
    this.categoriesMap = new Map<string, Category>(categories.map(category => [category.id, category]));
    registerCategoryIcons(categories, this.registeredIconNames);
  }

  private updateAvailableTags(transactions: Transaction[]): void {
    const tagsMap = new Map<string, string>();

    transactions.forEach((transaction) => {
      (transaction.tags ?? []).forEach((tag) => {
        const trimmedTag = tag.trim();
        if (!trimmedTag) {
          return;
        }

        const key = trimmedTag.toLowerCase();
        if (!tagsMap.has(key)) {
          tagsMap.set(key, trimmedTag);
        }
      });
    });

    this.availableTags = Array.from(tagsMap.values()).sort((first, second) =>
      first.localeCompare(second, undefined, { sensitivity: 'base' })
    );
  }

  private applyFilters(transactions: Transaction[]): Transaction[] {
    const selectedTypes = new Set(this.filters.types);
    const selectedCategoryIds = new Set(this.filters.categoryIds);
    const selectedAccountIds = new Set(this.filters.accountIds);
    const selectedTags = new Set(this.filters.tags.map((tag) => tag.toLowerCase()));

    const hasTypeFilter = selectedTypes.size !== this.allTransactionTypes.length;
    const hasCategoryFilter = selectedCategoryIds.size > 0;
    const hasAccountFilter = selectedAccountIds.size > 0;
    const hasTagFilter = selectedTags.size > 0;
    const hasDateFilter = true; // Always apply date range filtering

    if (!hasTypeFilter && !hasCategoryFilter && !hasAccountFilter && !hasTagFilter) {
      // Even if no other filters, still apply date range
      return transactions.filter((transaction) =>
        this.isTransactionInDateRange(transaction)
      );
    }

    return transactions.filter((transaction) => {
      if (hasTypeFilter && !selectedTypes.has(transaction.type)) {
        return false;
      }

      if (hasCategoryFilter && !selectedCategoryIds.has(transaction.categoryId)) {
        return false;
      }

      if (hasAccountFilter) {
        const matchesAccount = transaction.type === 'transfer'
          ? selectedAccountIds.has(transaction.accountId) || !!transaction.transferToAccountId && selectedAccountIds.has(transaction.transferToAccountId)
          : selectedAccountIds.has(transaction.accountId);

        if (!matchesAccount) {
          return false;
        }
      }

      if (hasTagFilter) {
        const transactionTags = (transaction.tags ?? []).map((tag) => tag.toLowerCase());
        const matchesAnyTag = transactionTags.some((tag) => selectedTags.has(tag));

        if (!matchesAnyTag) {
          return false;
        }
      }

      // Apply date range filter
      if (hasDateFilter && !this.isTransactionInDateRange(transaction)) {
        return false;
      }

      return true;
    });
  }

  private isTransactionInDateRange(transaction: Transaction): boolean {
    const transactionDate = new Date(transaction.date);
    transactionDate.setHours(0, 0, 0, 0);

    const startDate = new Date(this.selectedDateRange.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(this.selectedDateRange.endDate);
    endDate.setHours(23, 59, 59, 999);

    return transactionDate.getTime() >= startDate.getTime() && transactionDate.getTime() <= endDate.getTime();
  }

  private getDefaultFilters(): TransactionFilterState {
    return {
      types: [...this.allTransactionTypes],
      categoryIds: [],
      accountIds: [],
      tags: [],
    };
  }

  private getDefaultDateRange(): DateRange {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      startDate: startOfMonth,
      endDate: today,
      period: 'monthly',
    };
  }  private resetFilters(): void {
    this.filters = this.getDefaultFilters();
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
