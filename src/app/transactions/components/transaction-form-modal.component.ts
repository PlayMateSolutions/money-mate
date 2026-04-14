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
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonChip,
  IonIcon,
  IonNote,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronUpOutline, closeCircle } from 'ionicons/icons';
import { Account, Category, Transaction, TransactionType } from '../../core/database/models';
import { AccountRepository, CategoryRepository, TransactionRepository, CreateTransactionInput, UpdateTransactionInput } from '../../core/database/repositories';

@Component({
  selector: 'app-transaction-form-modal',
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
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonSegment,
    IonSegmentButton,
    IonChip,
    IonIcon,
    IonNote
  ],
  templateUrl: './transaction-form-modal.component.html',
  styles: [`
    ion-segment {
      margin-bottom: 4px;
    }
  `]
})
export class TransactionFormModalComponent implements OnInit {
  private readonly lastUsedAccountStorageKey = 'money-mate-last-used-account-id';
  @Input() transactionToEdit?: Transaction;
  accounts: Account[] = [];
  categories: Category[] = [];
  saving = false;
  showMoreOptions = false;
  tagInput = '';

  get isEditMode(): boolean {
    return !!this.transactionToEdit;
  }

  form: {
    type: TransactionType;
    amount: number | null;
    accountId: string;
    transferToAccountId: string;
    categoryId: string;
    date: string;
    description: string;
    notes: string;
    tags: string[];
  } = {
    type: 'expense',
    amount: null,
    accountId: '',
    transferToAccountId: '',
    categoryId: '',
    date: this.todayString(),
    description: '',
    notes: '',
    tags: []
  };

  constructor(
    private modalController: ModalController,
    private accountRepository: AccountRepository,
    private categoryRepository: CategoryRepository,
    private transactionRepository: TransactionRepository
  ) {
    addIcons({ closeCircle, chevronDownOutline, chevronUpOutline });
  }

  async ngOnInit(): Promise<void> {
    const [accounts, categories] = await Promise.all([
      this.accountRepository.getAccounts(),
      this.categoryRepository.getCategories()
    ]);
    this.accounts = accounts;
    this.categories = categories;

    if (this.transactionToEdit) {
      this.populateFormFromTransaction(this.transactionToEdit);
      return;
    }

    const lastUsedAccountId = this.getLastUsedAccountId();
    const hasLastUsedAccount = !!lastUsedAccountId && this.accounts.some((account) => account.id === lastUsedAccountId);

    if (hasLastUsedAccount) {
      this.form.accountId = lastUsedAccountId as string;
      return;
    }

    if (this.accounts.length > 0) {
      this.form.accountId = this.accounts[0].id;
    }
  }

  private populateFormFromTransaction(tx: Transaction): void {
    const date = new Date(tx.date);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    this.form = {
      type: tx.type,
      amount: Math.abs(tx.amount),
      accountId: tx.accountId,
      transferToAccountId: tx.transferToAccountId ?? '',
      categoryId: tx.categoryId ?? '',
      date: `${yyyy}-${mm}-${dd}`,
      description: tx.description ?? '',
      notes: tx.notes ?? '',
      tags: [...(tx.tags ?? [])],
    };

    if (tx.notes || tx.tags?.length) {
      this.showMoreOptions = true;
    }
  }

  private todayString(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  onTypeChange(): void {
    // Clear transfer-specific field when switching away
    if (this.form.type !== 'transfer') {
      this.form.transferToAccountId = '';
      return;
    }

    this.showMoreOptions = false;
    this.form.categoryId = '';
    this.form.description = '';
    this.form.notes = '';
    this.form.tags = [];
    this.tagInput = '';
  }

  onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }

  onDateChange(event: CustomEvent<{ value?: string | string[] | null }>): void {
    const value = event.detail.value;
    if (typeof value === 'string' && value) {
      this.form.date = value.slice(0, 10);
    }
  }

  addTag(): void {
    const tag = this.tagInput.trim().replace(/,+$/, '');
    if (tag && !this.form.tags.includes(tag)) {
      this.form.tags = [...this.form.tags, tag];
    }
    this.tagInput = '';
  }

  removeTag(tag: string): void {
    this.form.tags = this.form.tags.filter(t => t !== tag);
  }

  get canSave(): boolean {
    const hasAmount = this.form.amount !== null && Number(this.form.amount) > 0;
    const hasAccount = !!this.form.accountId;
    const hasToAccount = this.form.type !== 'transfer' || !!this.form.transferToAccountId;
    return hasAmount && hasAccount && hasToAccount;
  }

  async cancel(): Promise<void> {
    await this.modalController.dismiss(undefined, 'cancel');
  }

  async save(): Promise<void> {
    if (!this.canSave || this.saving) return;

    // Flush any pending tag in the input
    if (this.tagInput.trim()) {
      this.addTag();
    }

    this.saving = true;
    try {
      const baseInput = {
        accountId: this.form.accountId,
        amount: Number(this.form.amount),
        type: this.form.type,
        categoryId: this.form.type === 'transfer' ? '' : (this.form.categoryId || ''),
        description: this.form.description.trim(),
        date: new Date(this.form.date),
        notes: this.form.notes.trim() || undefined,
        tags: this.form.tags.length > 0 ? this.form.tags : undefined,
        transferToAccountId: this.form.type === 'transfer' ? this.form.transferToAccountId : undefined
      };

      let transaction: Transaction;
      if (this.isEditMode && this.transactionToEdit) {
        const input: UpdateTransactionInput = { ...baseInput, id: this.transactionToEdit.id };
        transaction = await this.transactionRepository.updateTransaction(input);
      } else {
        const input: CreateTransactionInput = baseInput;
        transaction = await this.transactionRepository.createTransaction(input);
        this.persistLastUsedAccountId(this.form.accountId);
      }

      await this.modalController.dismiss(transaction, 'saved');
    } catch (error) {
      console.error('Error saving transaction:', error);
      this.saving = false;
    }
  }

  private getLastUsedAccountId(): string | null {
    return localStorage.getItem(this.lastUsedAccountStorageKey);
  }

  private persistLastUsedAccountId(accountId: string): void {
    if (!accountId) {
      return;
    }

    localStorage.setItem(this.lastUsedAccountStorageKey, accountId);
  }
}
