import { Injectable } from '@angular/core';
import Papa from 'papaparse';
import { Account, AccountType, Category, CategoryType, Transaction, TransactionType } from '../database/models';
import { AccountRepository, CategoryRepository, TransactionRepository } from '../database/repositories';

interface CsvHeaderIndexMap {
  date: number;
  description: number;
  amount: number;
  fromAccount: number;
  toAccount: number;
  category: number;
}

export interface CsvImportAccountPreview {
  name: string;
  type: AccountType;
  ownerName: string;
  color: string;
  icon: string;
  notes: string;
  recordCount: number;
}

export interface CsvImportCategoryPreview {
  name: string;
  type?: CategoryType;
  color: string;
  icon: string;
  recordCount: number;
}

export interface CsvImportTransactionPreview {
  rowNumber: number;
  date: Date;
  description: string;
  amount: number;
  type: TransactionType;
  fromAccountName?: string;
  toAccountName?: string;
  categoryName?: string;
  createsAccounts: string[];
  createsCategories: string[];
  warnings: string[];
  duplicate: boolean;
}

export interface CsvImportInvalidRow {
  rowNumber: number;
  reasons: string[];
  rawValues: string[];
}

export interface CsvImportPreviewSummary {
  totalRows: number;
  importableTransactions: number;
  invalidRows: number;
  accountsToCreate: number;
  categoriesToCreate: number;
  warningRows: number;
  duplicateWarnings: number;
}

export interface CsvImportPreviewResult {
  summary: CsvImportPreviewSummary;
  accountsToCreate: CsvImportAccountPreview[];
  categoriesToCreate: CsvImportCategoryPreview[];
  transactionsToImport: CsvImportTransactionPreview[];
  duplicateWarnings: CsvImportTransactionPreview[];
  invalidRows: CsvImportInvalidRow[];
}

export interface CsvImportCommitResult {
  importedCount: number;
  createdAccounts: Account[];
  createdCategories: Category[];
  duplicateCount: number;
  skippedInvalidRows: number;
}

interface PendingCategoryState {
  preview: CsvImportCategoryPreview;
  inferredTypes: Set<Exclude<CategoryType, undefined>>;
}

@Injectable({
  providedIn: 'root'
})
export class CsvImportService {
  private readonly requiredHeaders = ['Date', 'Description', 'Amount', 'From Account', 'To Account', 'Category'] as const;
  private readonly accountDefaultsByType: Record<AccountType, Pick<CsvImportAccountPreview, 'icon'>> = {
    cash: { icon: 'cash-outline' },
    checking: { icon: 'card-outline' },
    savings: { icon: 'wallet-outline' },
    credit: { icon: 'card-outline' },
  };

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async buildQuickAddPreview(quickAddText: string, accountId: string): Promise<CsvImportPreviewResult> {
    const lines = this.parseQuickAddLines(quickAddText);
    if (lines.length === 0) {
      throw new Error('Enter at least one transaction line to preview.');
    }

    const selectedAccount = await this.accountRepository.getAccountByIdForSettings(accountId);
    if (!selectedAccount) {
      throw new Error('Select a valid account before previewing entries.');
    }

    const transactionsToImport: CsvImportTransactionPreview[] = [];
    const invalidRows: CsvImportInvalidRow[] = [];
    const referenceDate = new Date();

    lines.forEach((line, index) => {
      const rowNumber = index + 1;
      const parsedLine = this.parseQuickAddLine(line, referenceDate);

      if (parsedLine.reasons.length > 0 || !parsedLine.date || parsedLine.amount === null || !parsedLine.description) {
        invalidRows.push({
          rowNumber,
          reasons: parsedLine.reasons,
          rawValues: [line],
        });
        return;
      }

      transactionsToImport.push({
        rowNumber,
        date: parsedLine.date,
        description: parsedLine.description,
        amount: Math.abs(parsedLine.amount),
        type: 'expense',
        fromAccountName: selectedAccount.name,
        toAccountName: undefined,
        categoryName: undefined,
        createsAccounts: [],
        createsCategories: [],
        warnings: [],
        duplicate: false,
      });
    });

    return {
      summary: {
        totalRows: lines.length,
        importableTransactions: transactionsToImport.length,
        invalidRows: invalidRows.length,
        accountsToCreate: 0,
        categoriesToCreate: 0,
        warningRows: 0,
        duplicateWarnings: 0,
      },
      accountsToCreate: [],
      categoriesToCreate: [],
      transactionsToImport,
      duplicateWarnings: [],
      invalidRows,
    };
  }

  async buildPreview(csvText: string): Promise<CsvImportPreviewResult> {
    const rows = this.parseRows(csvText);
    if (rows.length < 2) {
      throw new Error('The CSV file must include a header row and at least one transaction row.');
    }
    console.log('Parsed CSV rows:', rows);

    const headers = this.buildHeaderIndexMap(rows[0]);
    console.log('CSV header index map:', headers);
    const [accounts, categories] = await Promise.all([
      this.accountRepository.getAccountsForSettings(),
      this.categoryRepository.getCategoriesForSettings(),
    //   this.transactionRepository.getAllTransactions(),
    ]);

    const accountNameMap = new Map<string, Account>(
      accounts.map((account) => [this.normalizeName(account.name), account])
    );
    const accountIdNameMap = new Map<string, string>(
      accounts.map((account) => [account.id, account.name])
    );
    const categoryNameMap = new Map<string, Category>(
      categories.map((category) => [this.normalizeName(category.name), category])
    );
    const categoryIdNameMap = new Map<string, string>(
      categories.map((category) => [category.id, category.name])
    );

    // const existsingDuplicateKeys = new Set(
    //   transactions.map((transaction) => this.buildExistingTransactionKey(transaction, accountIdNameMap, categoryIdNameMap)).filter(Boolean)
    // );
    const importDuplicateKeys = new Set<string>();

    const pendingAccounts = new Map<string, CsvImportAccountPreview>();
    const pendingCategories = new Map<string, PendingCategoryState>();
    const transactionsToImport: CsvImportTransactionPreview[] = [];
    const duplicateWarnings: CsvImportTransactionPreview[] = [];
    const invalidRows: CsvImportInvalidRow[] = [];

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 1;
      const raw = this.padRow(row, rows[0].length);
      const mapped = this.mapRow(raw, headers);
      const reasons: string[] = [];

      const parsedDate = this.parseDate(mapped.date);
      if (!parsedDate) {
        reasons.push('Invalid or missing date. Expected formats like 14-Apr-2026 or 2026-04-14.');
      }

      const parsedAmount = this.parseAmount(mapped.amount);
      if (parsedAmount === null || parsedAmount === 0) {
        reasons.push('Amount must be a non-zero number.');
      }

      const fromAccountName = this.cleanCell(mapped.fromAccount);
      const toAccountName = this.cleanCell(mapped.toAccount);
      const categoryName = this.cleanCell(mapped.category);
      const description = this.cleanCell(mapped.description) || 'Imported transaction';

      const type = this.inferTransactionType(fromAccountName, toAccountName);
      if (!type) {
        reasons.push('Either From Account or To Account is required.');
      }

      if (type === 'transfer' && fromAccountName && toAccountName && this.normalizeName(fromAccountName) === this.normalizeName(toAccountName)) {
        reasons.push('Transfer source and destination accounts must be different.');
      }

      if (reasons.length > 0 || !parsedDate || parsedAmount === null || parsedAmount === 0 || !type) {
        invalidRows.push({
          rowNumber,
          reasons,
          rawValues: raw,
        });
        continue;
      }

      const warnings: string[] = [];
      const createsAccounts = this.collectAccountsToCreate(
        type,
        fromAccountName,
        toAccountName,
        accountNameMap,
        pendingAccounts,
        rowNumber,
      );

      const createsCategories = this.collectCategoriesToCreate(
        type,
        categoryName,
        categoryNameMap,
        pendingCategories,
        rowNumber,
      );

      if (type === 'transfer' && categoryName) {
        warnings.push('Category will be ignored for transfer transactions.');
      }

      const preview: CsvImportTransactionPreview = {
        rowNumber,
        date: parsedDate,
        description,
        amount: Math.abs(parsedAmount),
        type,
        fromAccountName: fromAccountName || undefined,
        toAccountName: toAccountName || undefined,
        categoryName: type === 'transfer' ? undefined : (categoryName || undefined),
        createsAccounts,
        createsCategories,
        warnings,
        duplicate: false,
      };

    //   const transactionKey = this.buildPreviewTransactionKey(preview);
    //   if (existingDuplicateKeys.has(transactionKey)) {
    //     preview.duplicate = true;
    //     preview.warnings.push('Looks like an existing transaction already in Money Mate.');
    //   }

    //   if (importDuplicateKeys.has(transactionKey)) {
    //     preview.duplicate = true;
    //     preview.warnings.push('Looks duplicated within this CSV file.');
    //   } else {
    //     importDuplicateKeys.add(transactionKey);
    //   }

    //   if (preview.duplicate) {
    //     duplicateWarnings.push(preview);
    //   }

      transactionsToImport.push(preview);
      console.log(`Processed row ${rowNumber}:`, preview);
    }

    const categoriesToCreate = Array.from(pendingCategories.values()).map((state) => ({
      ...state.preview,
      type: state.inferredTypes.size === 1 ? Array.from(state.inferredTypes)[0] : undefined,
    }));

    console.log('CSV import preview summary built');
    return {
      summary: {
        totalRows: rows.length - 1,
        importableTransactions: transactionsToImport.length,
        invalidRows: invalidRows.length,
        accountsToCreate: pendingAccounts.size,
        categoriesToCreate: categoriesToCreate.length,
        warningRows: transactionsToImport.filter((transaction) => transaction.warnings.length > 0).length,
        duplicateWarnings: duplicateWarnings.length,
      },
      accountsToCreate: Array.from(pendingAccounts.values()),
      categoriesToCreate,
      transactionsToImport,
      duplicateWarnings,
      invalidRows,
    };
  }

  async importPreview(preview: CsvImportPreviewResult): Promise<CsvImportCommitResult> {
    const [accounts, categories] = await Promise.all([
      this.accountRepository.getAccountsForSettings(),
      this.categoryRepository.getCategoriesForSettings(),
    ]);

    const accountNameMap = new Map<string, Account>(
      accounts.map((account) => [this.normalizeName(account.name), account])
    );
    const categoryNameMap = new Map<string, Category>(
      categories.map((category) => [this.normalizeName(category.name), category])
    );

    const createdAccounts: Account[] = [];
    for (const accountPreview of preview.accountsToCreate) {
      const key = this.normalizeName(accountPreview.name);
      if (accountNameMap.has(key)) {
        continue;
      }

      const createdAccount = await this.accountRepository.createAccount({
        name: accountPreview.name,
        type: accountPreview.type,
        balance: 0,
        ownerName: accountPreview.ownerName,
        color: accountPreview.color,
        icon: accountPreview.icon,
        notes: accountPreview.notes,
      });

      accountNameMap.set(key, createdAccount);
      createdAccounts.push(createdAccount);
    }

    const createdCategories: Category[] = [];
    for (const categoryPreview of preview.categoriesToCreate) {
      const key = this.normalizeName(categoryPreview.name);
      if (categoryNameMap.has(key)) {
        continue;
      }

      const createdCategory = await this.categoryRepository.createCategory({
        name: categoryPreview.name,
        type: categoryPreview.type,
        color: categoryPreview.color,
        icon: categoryPreview.icon,
      });

      categoryNameMap.set(key, createdCategory);
      createdCategories.push(createdCategory);
    }

    let importedCount = 0;
    for (const transactionPreview of preview.transactionsToImport) {
      const accountId = this.resolvePrimaryAccountId(transactionPreview, accountNameMap);
      if (!accountId) {
        throw new Error(`Unable to resolve the primary account for row ${transactionPreview.rowNumber}.`);
      }

      const transferToAccountId = transactionPreview.type === 'transfer' && transactionPreview.toAccountName
        ? accountNameMap.get(this.normalizeName(transactionPreview.toAccountName))?.id
        : undefined;

      if (transactionPreview.type === 'transfer' && !transferToAccountId) {
        throw new Error(`Unable to resolve the destination account for transfer row ${transactionPreview.rowNumber}.`);
      }

      const categoryId = transactionPreview.type === 'transfer' || !transactionPreview.categoryName
        ? ''
        : categoryNameMap.get(this.normalizeName(transactionPreview.categoryName))?.id || '';

      await this.transactionRepository.createTransaction({
        accountId,
        amount: transactionPreview.amount,
        type: transactionPreview.type,
        categoryId,
        description: transactionPreview.description,
        date: transactionPreview.date,
        transferToAccountId,
      });

      importedCount += 1;
    }

    await this.transactionRepository.getAllTransactions();

    return {
      importedCount,
      createdAccounts,
      createdCategories,
      duplicateCount: preview.duplicateWarnings.length,
      skippedInvalidRows: preview.invalidRows.length,
    };
  }

  private parseRows(csvText: string): string[][] {
    const result = Papa.parse<string[]>(csvText, {
      skipEmptyLines: 'greedy',
    });

    if (result.errors.length > 0) {
      const message = result.errors[0]?.message || 'Unable to parse the CSV file.';
      throw new Error(message);
    }

    return result.data.map((row) => row.map((cell) => this.cleanCell(cell)));
  }

  private parseQuickAddLines(quickAddText: string): string[] {
    return quickAddText
      .split(/\r?\n/)
      .map((line) => this.cleanCell(line))
      .filter((line) => !!line);
  }

  private parseQuickAddLine(line: string, referenceDate: Date): {
    date: Date | null;
    description: string;
    amount: number | null;
    reasons: string[];
  } {
    const reasons: string[] = [];
    const trimmedLine = this.cleanCell(line);

    if (!trimmedLine) {
      return {
        date: null,
        description: '',
        amount: null,
        reasons: ['Line is empty.'],
      };
    }

    const tokens = trimmedLine.split(/\s+/).filter((token) => !!token);
    if (tokens.length < 2) {
      return {
        date: null,
        description: '',
        amount: null,
        reasons: ['Each line must include a description and an amount.'],
      };
    }

    let tokenStartIndex = 0;
    let date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

    if (tokens.length >= 3) {
      const dayMonthMatch = /^(\d{1,2})\/(\d{1,2})$/.exec(tokens[0]);
      if (dayMonthMatch) {
        tokenStartIndex = 1;
        const day = Number(dayMonthMatch[1]);
        const month = Number(dayMonthMatch[2]);
        const parsedQuickDate = this.buildDateFromDayAndMonth(day, month, referenceDate);
        if (!parsedQuickDate) {
          reasons.push('Invalid day/month date. Use values like 14/3.');
        } else {
          date = parsedQuickDate;
        }
      } else if (/^\d{1,2}$/.test(tokens[0])) {
        tokenStartIndex = 1;
        const day = Number(tokens[0]);
        const parsedQuickDate = this.buildCurrentMonthDate(day, referenceDate);
        if (!parsedQuickDate) {
          reasons.push('Invalid day for the current month.');
        } else {
          date = parsedQuickDate;
        }
      }
    }

    const amountToken = tokens[tokens.length - 1] || '';
    const amount = this.parseAmount(amountToken);
    if (amount === null || amount === 0) {
      reasons.push('Amount must be a non-zero number at the end of the line.');
    }

    const rawDescription = tokens.slice(tokenStartIndex, -1).join(' ').trim();
    const description = this.capitalizeDescription(rawDescription);
    if (!description) {
      reasons.push('Description is required before the amount.');
    }

    return {
      date,
      description,
      amount,
      reasons,
    };
  }

  private capitalizeDescription(value: string): string {
    return this.cleanCell(value)
      .split(/\s+/)
      .filter((part) => !!part)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private buildHeaderIndexMap(headerRow: string[]): CsvHeaderIndexMap {
    const normalizedHeaderMap = new Map<string, number>();
    headerRow.forEach((value, index) => {
      normalizedHeaderMap.set(this.normalizeHeader(value), index);
    });

    const date = normalizedHeaderMap.get('date');
    const description = normalizedHeaderMap.get('description');
    const amount = normalizedHeaderMap.get('amount');
    const fromAccount = normalizedHeaderMap.get('from account');
    const toAccount = normalizedHeaderMap.get('to account');
    const category = normalizedHeaderMap.get('category');

    const missingHeaders = this.requiredHeaders.filter((header) => {
      switch (header) {
        case 'Date':
          return date === undefined;
        case 'Description':
          return description === undefined;
        case 'Amount':
          return amount === undefined;
        case 'From Account':
          return fromAccount === undefined;
        case 'To Account':
          return toAccount === undefined;
        case 'Category':
          return category === undefined;
      }
    });

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    return {
      date: date ?? 0,
      description: description ?? 0,
      amount: amount ?? 0,
      fromAccount: fromAccount ?? 0,
      toAccount: toAccount ?? 0,
      category: category ?? 0,
    };
  }

  private mapRow(row: string[], headers: CsvHeaderIndexMap): Record<keyof CsvHeaderIndexMap, string> {
    return {
      date: row[headers.date] || '',
      description: row[headers.description] || '',
      amount: row[headers.amount] || '',
      fromAccount: row[headers.fromAccount] || '',
      toAccount: row[headers.toAccount] || '',
      category: row[headers.category] || '',
    };
  }

  // Ensure a parsed CSV row has at least the expected number of columns,
  // filling missing trailing values with empty strings for safe header-index access.
  private padRow(row: string[], length: number): string[] {
    if (row.length >= length) {
      return row;
    }

    return [...row, ...Array.from({ length: length - row.length }, () => '')];
  }

  private buildCurrentMonthDate(day: number, referenceDate: Date): Date | null {
    if (!Number.isInteger(day) || day <= 0) {
      return null;
    }

    const lastDayOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
    if (day > lastDayOfMonth) {
      return null;
    }

    return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day);
  }

  private buildDateFromDayAndMonth(day: number, month: number, referenceDate: Date): Date | null {
    if (!Number.isInteger(day) || !Number.isInteger(month) || day <= 0 || month <= 0 || month > 12) {
      return null;
    }

    const year = referenceDate.getFullYear();
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    if (day > lastDayOfMonth) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private parseDate(value: string): Date | null {
    const trimmedValue = this.cleanCell(value);
    if (!trimmedValue) {
      return null;
    }

    const dayMonthYearMatch = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(trimmedValue);
    if (dayMonthYearMatch) {
      const day = Number(dayMonthYearMatch[1]);
      const month = this.getMonthIndex(dayMonthYearMatch[2]);
      const year = Number(dayMonthYearMatch[3]);
      if (month >= 0) {
        return new Date(year, month, day);
      }
    }

    const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);
    if (isoDateMatch) {
      const year = Number(isoDateMatch[1]);
      const month = Number(isoDateMatch[2]) - 1;
      const day = Number(isoDateMatch[3]);
      return new Date(year, month, day);
    }

    const slashDateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmedValue);
    if (slashDateMatch) {
      const day = Number(slashDateMatch[1]);
      const month = Number(slashDateMatch[2]) - 1;
      const year = Number(slashDateMatch[3]);
      return new Date(year, month, day);
    }

    const fallback = new Date(trimmedValue);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  private parseAmount(value: string): number | null {
    const normalizedValue = this.cleanCell(value)
      .replace(/,/g, '')
      .replace(/^\((.*)\)$/, '-$1')
      .replace(/[^\d.-]/g, '');

    if (!normalizedValue) {
      return null;
    }

    const parsed = Number(normalizedValue);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private inferTransactionType(fromAccountName: string, toAccountName: string): TransactionType | null {
    if (fromAccountName && toAccountName) {
      return 'transfer';
    }

    if (fromAccountName) {
      return 'expense';
    }

    if (toAccountName) {
      return 'income';
    }

    return null;
  }

  private collectAccountsToCreate(
    type: TransactionType,
    fromAccountName: string,
    toAccountName: string,
    accountNameMap: Map<string, Account>,
    pendingAccounts: Map<string, CsvImportAccountPreview>,
    rowNumber: number,
  ): string[] {
    const namesToCheck = [fromAccountName, toAccountName].filter((name): name is string => !!name);
    const createsAccounts: string[] = [];

    namesToCheck.forEach((accountName) => {
      const key = this.normalizeName(accountName);
      if (accountNameMap.has(key)) {
        return;
      }

      if (!pendingAccounts.has(key)) {
        const accountType = this.inferAccountType(type);
        const defaults = this.accountDefaultsByType[accountType];
        pendingAccounts.set(key, {
          name: accountName,
          type: accountType,
          ownerName: 'Imported CSV',
          color: this.generateRandomColor(),
          icon: defaults.icon,
          notes: 'Created during CSV import',
          recordCount: 1,
        });
      } else {
        const existing = pendingAccounts.get(key);
        if (existing) {
          existing.recordCount += 1;
        }
      }

      createsAccounts.push(accountName);
    });

    return createsAccounts;
  }

  private collectCategoriesToCreate(
    type: TransactionType,
    categoryName: string,
    categoryNameMap: Map<string, Category>,
    pendingCategories: Map<string, PendingCategoryState>,
    rowNumber: number,
  ): string[] {
    if (type === 'transfer' || !categoryName) {
      return [];
    }

    const key = this.normalizeName(categoryName);
    if (categoryNameMap.has(key)) {
      return [];
    }

    const inferredType: Exclude<CategoryType, undefined> = type === 'income' ? 'income' : 'expense';
    const existing = pendingCategories.get(key);
    if (!existing) {
      pendingCategories.set(key, {
        preview: {
          name: categoryName,
          type: inferredType,
          color: this.generateRandomColor(),
          icon: 'pricetag-outline',
          recordCount: 1,
        },
        inferredTypes: new Set([inferredType]),
      });
    } else {
      existing.preview.recordCount += 1;
      existing.inferredTypes.add(inferredType);
    }

    return [categoryName];
  }

  private resolvePrimaryAccountId(
    transactionPreview: CsvImportTransactionPreview,
    accountNameMap: Map<string, Account>,
  ): string | undefined {
    const accountName = transactionPreview.type === 'income'
      ? transactionPreview.toAccountName
      : transactionPreview.fromAccountName;

    if (!accountName) {
      return undefined;
    }

    return accountNameMap.get(this.normalizeName(accountName))?.id;
  }

  private inferAccountType(type: TransactionType): AccountType {
    switch (type) {
      case 'transfer':
      case 'income':
      case 'expense':
      default:
        return 'savings';
    }
  }

  private generateRandomColor(): string {
    return ('#' + ((Math.random() * 0xFFFFFF) << 0).toString(16).padStart(6, '0')).toUpperCase();
  }

  private buildExistingTransactionKey(
    transaction: Transaction,
    accountIdNameMap: Map<string, string>,
    categoryIdNameMap: Map<string, string>,
  ): string {
    const accountName = transaction.accountId ? (accountIdNameMap.get(transaction.accountId) || '') : '';
    const transferName = transaction.transferToAccountId ? (accountIdNameMap.get(transaction.transferToAccountId) || '') : '';
    const categoryName = transaction.categoryId ? (categoryIdNameMap.get(transaction.categoryId) || '') : '';

    return this.composeTransactionKey({
      date: new Date(transaction.date),
      description: transaction.description || 'Imported transaction',
      amount: Math.abs(transaction.amount),
      type: transaction.type,
      fromAccountName: transaction.type === 'income' ? '' : accountName,
      toAccountName: transaction.type === 'income' ? accountName : transferName,
      categoryName: transaction.type === 'transfer' ? '' : categoryName,
    });
  }

  private buildPreviewTransactionKey(transaction: CsvImportTransactionPreview): string {
    return this.composeTransactionKey({
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      fromAccountName: transaction.fromAccountName || '',
      toAccountName: transaction.toAccountName || '',
      categoryName: transaction.categoryName || '',
    });
  }

  private composeTransactionKey(input: {
    date: Date;
    description: string;
    amount: number;
    type: TransactionType;
    fromAccountName: string;
    toAccountName: string;
    categoryName: string;
  }): string {
    const dateKey = [
      input.date.getFullYear(),
      String(input.date.getMonth() + 1).padStart(2, '0'),
      String(input.date.getDate()).padStart(2, '0'),
    ].join('-');

    return [
      dateKey,
      this.normalizeName(input.description || 'Imported transaction'),
      input.type,
      input.amount.toFixed(2),
      this.normalizeName(input.fromAccountName),
      this.normalizeName(input.toAccountName),
      this.normalizeName(input.categoryName),
    ].join('|');
  }

  private normalizeHeader(value: string): string {
    return this.cleanCell(value)
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private normalizeName(value: string): string {
    return this.cleanCell(value)
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private cleanCell(value: string | undefined): string {
    return (value || '').trim();
  }

  private getMonthIndex(value: string): number {
    const normalizedValue = value.trim().slice(0, 3).toLowerCase();
    const monthLookup = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    return monthLookup.indexOf(normalizedValue);
  }
}
