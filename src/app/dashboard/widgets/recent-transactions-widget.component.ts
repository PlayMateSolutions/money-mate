import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonText,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import * as ionicons from 'ionicons/icons';
import { pricetagOutline, swapHorizontalOutline } from 'ionicons/icons';
import { Account, Category, Transaction } from '../../core/database/models';
import {
  AccountRepository,
  CategoryRepository,
  TransactionRepository,
} from '../../core/database/repositories';

interface RecentTransactionItem {
  id: string;
  transactionType: Transaction['type'];
  description: string;
  categoryName: string;
  accountName: string;
  transferToAccountName?: string;
  iconName: string;
  iconColor: string;
  amount: number;
  date: Date;
}

@Component({
  selector: 'app-recent-transactions-widget',
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonButton,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonText,
    IonIcon,
  ],
  templateUrl: './recent-transactions-widget.component.html',
  styleUrls: ['./recent-transactions-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentTransactionsWidgetComponent implements OnInit, OnDestroy {
  items: RecentTransactionItem[] = [];
  loading = true;
  error: string | null = null;

  private readonly maxItems = 5;
  private transactionsSub?: Subscription;
  private accountsMap = new Map<string, Account>();
  private categoriesMap = new Map<string, Category>();
  private registeredIconNames = new Set<string>([
    'pricetag-outline',
    'swap-horizontal-outline'
  ]);

  constructor(
    private readonly router: Router,
    private readonly transactionRepository: TransactionRepository,
    private readonly accountRepository: AccountRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly cdr: ChangeDetectorRef,
  ) {
    addIcons({
      pricetagOutline,
      swapHorizontalOutline,
    });
  }

  ngOnInit(): void {
    void this.initialize();
  }

  ngOnDestroy(): void {
    this.transactionsSub?.unsubscribe();
  }

  trackByItemId(_: number, item: RecentTransactionItem): string {
    return item.id;
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  getSignedAmountPrefix(amount: number): string {
    return amount > 0 ? '+' : '';
  }

  getTransferSubtitle(item: RecentTransactionItem): string {
    return `${item.accountName} → ${item.transferToAccountName ?? 'Unknown account'}`;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
    });
  }

  async viewAll(): Promise<void> {
    await this.router.navigate(['/tabs/transactions']);
  }

  private async initialize(): Promise<void> {
    try {
      this.loading = true;
      this.error = null;
      this.cdr.markForCheck();

      await this.refreshLookups();

      this.transactionsSub = this.transactionRepository.getTransactions$().subscribe({
        next: (transactions) => {
          this.items = this.buildItems(transactions);
          this.loading = false;
          this.error = null;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error('Error loading recent transactions:', error);
          this.items = [];
          this.loading = false;
          this.error = 'Failed to load transactions';
          this.cdr.markForCheck();
        }
      });
    } catch (error) {
      console.error('Error initializing recent transactions widget:', error);
      this.items = [];
      this.loading = false;
      this.error = 'Failed to load transactions';
      this.cdr.markForCheck();
    }
  }

  private async refreshLookups(): Promise<void> {
    const [accounts, categories] = await Promise.all([
      this.accountRepository.getAccountsForSettings(),
      this.categoryRepository.getCategoriesForSettings(),
    ]);

    this.accountsMap = new Map<string, Account>(accounts.map((account) => [account.id, account]));
    this.categoriesMap = new Map<string, Category>(categories.map((category) => [category.id, category]));
    this.registerIconsFromCategories(categories);
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

  private buildItems(transactions: Transaction[]): RecentTransactionItem[] {
    return transactions.slice(0, this.maxItems).map((transaction) => {
      const accountName = this.accountsMap.get(transaction.accountId)?.name ?? 'Unknown account';
      const transferToAccountName = transaction.transferToAccountId
        ? this.accountsMap.get(transaction.transferToAccountId)?.name
        : undefined;
      const category = this.categoriesMap.get(transaction.categoryId);
      const categoryName = transaction.type === 'transfer'
        ? 'Transfer'
        : (category?.name ?? 'Uncategorized');
      const categoryColor = category?.color || 'var(--ion-color-medium)';
      const categoryIconName = category?.icon?.trim();
      const iconName = transaction.type === 'transfer'
        ? 'swap-horizontal-outline'
        : (categoryIconName && this.registeredIconNames.has(categoryIconName) ? categoryIconName : 'pricetag-outline');
      const iconColor = transaction.type === 'transfer' ? 'var(--ion-color-medium)' : categoryColor;

      return {
        id: transaction.id,
        transactionType: transaction.type,
        description: transaction.description,
        categoryName,
        accountName,
        transferToAccountName,
        iconName,
        iconColor,
        amount: transaction.amount,
        date: new Date(transaction.date),
      };
    });
  }
}
