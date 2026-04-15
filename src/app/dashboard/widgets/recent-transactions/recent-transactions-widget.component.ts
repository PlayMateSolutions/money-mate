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
import { pricetagOutline, swapHorizontalOutline } from 'ionicons/icons';
import { Account, Category, Transaction } from '../../../core/database/models';
import {
  AccountRepository,
  CategoryRepository,
  TransactionRepository,
} from '../../../core/database/repositories';
import {
  buildTransactionDisplayItem,
  registerCategoryIcons,
  TransactionDisplayItem,
} from '../../../core/services';

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
  private readonly CURRENCY_KEY = 'money-mate-currency';
  items: TransactionDisplayItem[] = [];
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

  trackByItemId(_: number, item: TransactionDisplayItem): string {
    return item.id;
  }

  formatAmount(amount: number): string {
    const currencyCode = localStorage.getItem(this.CURRENCY_KEY) || 'USD';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(Math.abs(amount));
  }

  getTransferSubtitle(item: TransactionDisplayItem): string {
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

      this.transactionsSub = this.transactionRepository.getRecentTransactions$(this.maxItems).subscribe({
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
    registerCategoryIcons(categories, this.registeredIconNames);
  }

  private buildItems(transactions: Transaction[]): TransactionDisplayItem[] {
    return transactions.slice(0, this.maxItems).map((transaction) => (
      buildTransactionDisplayItem(
        transaction,
        this.accountsMap,
        this.categoriesMap,
        this.registeredIconNames,
      )
    ));
  }
}
