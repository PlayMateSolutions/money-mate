import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonBadge,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { helpCircleOutline } from 'ionicons/icons';
import { Account, Category } from '../core/database/models';
import { AccountRepository, CategoryRepository, TransactionRepository } from '../core/database/repositories';
import {
  CsvImportCommitResult,
  CsvImportInvalidRow,
  CsvImportPreviewResult,
  CsvImportService,
  CsvImportTransactionPreview,
} from '../core/services/csv-import.service';

@Component({
  selector: 'app-transaction-quick-add',
  standalone: true,
  templateUrl: './transaction-quick-add.page.html',
  styleUrls: ['./transaction-quick-add.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonBadge,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionQuickAddPage implements OnInit {
  private readonly currencyKey = 'money-mate-currency';
  private readonly previewDisplayLimit = 500;
  accounts: Account[] = [];
  selectedCurrency = 'USD';
  selectedAccountId = '';
  quickEntryText = '';
  loadingAccounts = false;
  processing = false;
  importing = false;
  error: string | null = null;
  preview: CsvImportPreviewResult | null = null;
  importResult: CsvImportCommitResult | null = null;

  /**
   * Mapping from normalized description to categoryId, built from past year transactions.
   */
  private descriptionCategoryMap = new Map<string, string>();
  /**
   * categoryId -> Category
   */
  private categoriesMap = new Map<string, Category>();

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly csvImportService: CsvImportService,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController,
    private readonly cdr: ChangeDetectorRef,
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {
    addIcons({
      helpCircleOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    this.selectedCurrency = localStorage.getItem(this.currencyKey) || 'USD';
    await this.loadAccounts();
    await this.buildDescriptionCategoryMap();
  }

  /**
   * Normalize a description for matching: trim and lowercase.
   */
  private normalizeDescription(desc: string): string {
    return desc.trim().toLowerCase();
  }

  /**
   * Fetch transactions from the past year and build a normalized description->categoryId map. Also build categoryId->Category map.
   */
  private async buildDescriptionCategoryMap(): Promise<void> {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    try {
      const [transactions, categories] = await Promise.all([
        this.transactionRepository.getTransactionsByDateRange(oneYearAgo, now),
        this.categoryRepository.getCategoriesForSettings(),
      ]);
      for (const cat of categories) {
        this.categoriesMap.set(cat.id, cat);
      }
      for (const tx of transactions) {
        if (tx.description && tx.categoryId) {
          const norm = this.normalizeDescription(tx.description);
          if (!this.descriptionCategoryMap.has(norm)) {
            this.descriptionCategoryMap.set(norm, tx.categoryId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to build description->category map', err);
    }
  }

  get canPreview(): boolean {
    return !!this.selectedAccountId && !!this.quickEntryText.trim();
  }

  get canImport(): boolean {
    return !!this.preview && this.preview.transactionsToImport.length > 0 && !this.importResult;
  }

  get displayedTransactions(): CsvImportTransactionPreview[] {
    if (!this.preview) {
      return [];
    }

    return this.preview.transactionsToImport.slice(0, this.previewDisplayLimit);
  }

  get displayedPreviewRows(): CsvImportTransactionPreview[] {
    if (!this.preview) {
      return [];
    }

    const invalidRowsAsPreview: CsvImportTransactionPreview[] = this.preview.invalidRows.map((invalidRow) => {
      const rawInput = this.formatInvalidRow(invalidRow);
      return {
        rowNumber: invalidRow.rowNumber,
        date: new Date(),
        description: `Input ${rawInput}`,
        amount: 0,
        type: 'expense',
        fromAccountName: undefined,
        toAccountName: undefined,
        categoryName: undefined,
        createsAccounts: [],
        createsCategories: [],
        warnings: [...invalidRow.reasons],
        duplicate: false,
      };
    });

    return [...this.preview.transactionsToImport, ...invalidRowsAsPreview]
      .sort((left, right) => left.rowNumber - right.rowNumber)
      .slice(0, this.previewDisplayLimit);
  }

  get hasTruncatedTransactionPreview(): boolean {
    if (!this.preview) {
      return false;
    }

    return (this.preview.transactionsToImport.length + this.preview.invalidRows.length) > this.previewDisplayLimit;
  }

  async loadAccounts(): Promise<void> {
    this.loadingAccounts = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      this.accounts = await this.accountRepository.getAccountsForSettings();

      const hasSelectedAccount = !!this.selectedAccountId && this.accounts.some((account) => account.id === this.selectedAccountId);
      if (!hasSelectedAccount) {
        this.selectedAccountId = this.accounts[0]?.id || '';
      }
    } catch (error) {
      console.error('Error loading accounts for quick add:', error);
      this.error = error instanceof Error ? error.message : 'Failed to load accounts.';
    } finally {
      this.loadingAccounts = false;
      this.cdr.markForCheck();
    }
  }

  onFormChanged(): void {
    this.preview = null;
    this.importResult = null;
    this.error = null;
    this.cdr.markForCheck();
  }

  async previewQuickAdd(): Promise<void> {
    if (!this.canPreview) {
      return;
    }

    this.processing = true;
    this.error = null;
    this.preview = null;
    this.importResult = null;
    this.cdr.markForCheck();

    try {
      this.preview = await this.csvImportService.buildQuickAddPreview(this.quickEntryText, this.selectedAccountId);
      // Auto-categorize: assign categoryName if description matches
      if (this.preview && this.preview.transactionsToImport.length > 0) {
        for (const tx of this.preview.transactionsToImport) {
          const norm = this.normalizeDescription(tx.description);
          const catId = this.descriptionCategoryMap.get(norm);
          if (catId) {
            const cat = this.categoriesMap.get(catId);
            if (cat) {
              tx.categoryName = cat.name;
              console.log(`Auto-categorized "${tx.description}" as "${cat.name}" based on past transactions`);
            }
          }
        }
      }
      this.processing = false;
      this.cdr.detectChanges();
    //   await this.presentToast('Entries processed successfully', 'success');
    } catch (error) {
      console.error('Error processing quick add entries:', error);
      this.error = error instanceof Error ? error.message : 'Failed to process quick add entries.';
      this.processing = false;
      this.cdr.detectChanges();
      await this.presentToast(this.error, 'danger');
    } finally {
      this.processing = false;
      this.cdr.detectChanges();
    }
  }

  async importTransactions(): Promise<void> {
    if (!this.preview || this.importing || this.importResult) {
      return;
    }

    this.importing = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      this.importResult = await this.csvImportService.importPreview(this.preview);
      this.importing = false;
      this.cdr.detectChanges();
      await this.presentToast(`Imported ${this.importResult.importedCount} transactions`, 'success');
    } catch (error) {
      console.error('Error importing quick add transactions:', error);
      this.error = error instanceof Error ? error.message : 'Failed to import quick add transactions.';
      this.importing = false;
      this.cdr.detectChanges();
      await this.presentToast(this.error, 'danger');
    } finally {
      this.importing = false;
      this.cdr.detectChanges();
    }
  }

  clearAndStartOver(): void {
    if (this.processing || this.importing) {
      return;
    }

    this.quickEntryText = '';
    this.preview = null;
    this.importResult = null;
    this.error = null;
    this.cdr.markForCheck();
  }

  async showHelp(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Quick Add Help',
      message: 'Enter one transaction per line. Example:\n\n14 Milk 32\n15 Tea 12\n1 Petrol 200\n\nIf a line starts with a number, it will be treated as the day in the current month. If no day is given, today will be used. The selected account applies to every line.',
      buttons: ['OK'],
    });

    await alert.present();
  }

  trackByAccount(_: number, account: Account): string {
    return account.id;
  }

  trackByTransactionRow(_: number, transaction: CsvImportTransactionPreview): number {
    return transaction.rowNumber;
  }

  isSkippedRow(rowNumber: number): boolean {
    if (!this.preview) {
      return false;
    }

    return this.preview.invalidRows.some((row) => row.rowNumber === rowNumber);
  }

  trackByPreviewRow(_: number, row: CsvImportTransactionPreview): number {
    return row.rowNumber;
  }

  formatInvalidRow(row: CsvImportInvalidRow): string {
    return row.rawValues.filter((value) => !!value).join(' • ');
  }

  private async presentToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });

    await toast.present();
  }
}
