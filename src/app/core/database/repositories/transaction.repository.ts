import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { DatabaseService } from '../database.service';
import { GUEST_USER_NAME, Transaction, TransactionType } from '../models';

export interface CreateTransactionInput {
  accountId: string;
  amount: number; // always positive from UI
  type: TransactionType;
  categoryId: string;
  description: string;
  date: Date;
  notes?: string;
  tags?: string[];
  transferToAccountId?: string;
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionRepository {
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  public transactions$ = this.transactionsSubject.asObservable();
  private recentTransactionsSubject = new BehaviorSubject<Transaction[]>([]);
  public recentTransactions$ = this.recentTransactionsSubject.asObservable();
  private readonly recentTransactionsCacheSize = 10;

  constructor(private db: DatabaseService) {}

  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    const now = new Date();
    const id = crypto.randomUUID();

    let storedAmount: number;
    if (input.type === 'expense') {
      storedAmount = -Math.abs(input.amount);
    } else {
      storedAmount = Math.abs(input.amount);
    }

    const transaction: Transaction = {
      id,
      accountId: input.accountId,
      amount: storedAmount,
      type: input.type,
      categoryId: input.categoryId,
      description: input.description,
      date: input.date,
      notes: input.notes,
      tags: input.tags ?? [],
      transferToAccountId: input.transferToAccountId,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy: GUEST_USER_NAME,
      updatedBy: GUEST_USER_NAME,
    };

    await this.db.transaction('rw', [this.db.transactions, this.db.accounts], async () => {
      await this.db.transactions.add(transaction);

      if (input.type === 'transfer' && input.transferToAccountId) {
        // Debit source account
        const source = await this.db.accounts.get(input.accountId);
        if (source) {
          await this.db.accounts.update(input.accountId, {
            balance: source.balance - Math.abs(input.amount),
            updatedAt: now
          });
        }
        // Credit destination account
        const dest = await this.db.accounts.get(input.transferToAccountId);
        if (dest) {
          await this.db.accounts.update(input.transferToAccountId, {
            balance: dest.balance + Math.abs(input.amount),
            updatedAt: now
          });
        }
      } else {
        const account = await this.db.accounts.get(input.accountId);
        if (account) {
          await this.db.accounts.update(input.accountId, {
            balance: account.balance + storedAmount,
            updatedAt: now
          });
        }
      }
    });

    await this.refreshTransactionStreams();

    return transaction;
  }

  async updateTransaction(input: UpdateTransactionInput): Promise<Transaction> {
    const now = new Date();

    let storedAmount: number;
    if (input.type === 'expense') {
      storedAmount = -Math.abs(input.amount);
    } else {
      storedAmount = Math.abs(input.amount);
    }

    const oldTx = await this.db.transactions.get(input.id);
    if (!oldTx) {
      throw new Error(`Transaction ${input.id} not found`);
    }

    const updated: Transaction = {
      ...oldTx,
      accountId: input.accountId,
      amount: storedAmount,
      type: input.type,
      categoryId: input.categoryId,
      description: input.description,
      date: input.date,
      notes: input.notes,
      tags: input.tags ?? [],
      transferToAccountId: input.type === 'transfer' ? input.transferToAccountId : undefined,
      updatedAt: now,
      updatedBy: GUEST_USER_NAME,
    };

    await this.db.transaction('rw', [this.db.transactions, this.db.accounts], async () => {
      // Reverse old transaction's balance effect
      if (oldTx.type === 'transfer' && oldTx.transferToAccountId) {
        const oldSource = await this.db.accounts.get(oldTx.accountId);
        if (oldSource) {
          await this.db.accounts.update(oldTx.accountId, { balance: oldSource.balance + Math.abs(oldTx.amount), updatedAt: now });
        }
        const oldDest = await this.db.accounts.get(oldTx.transferToAccountId);
        if (oldDest) {
          await this.db.accounts.update(oldTx.transferToAccountId, { balance: oldDest.balance - Math.abs(oldTx.amount), updatedAt: now });
        }
      } else {
        const oldAccount = await this.db.accounts.get(oldTx.accountId);
        if (oldAccount) {
          // oldTx.amount is negative for expense, positive for income — subtracting reverses the effect
          await this.db.accounts.update(oldTx.accountId, { balance: oldAccount.balance - oldTx.amount, updatedAt: now });
        }
      }

      // Apply new transaction's balance effect
      if (input.type === 'transfer' && input.transferToAccountId) {
        const newSource = await this.db.accounts.get(input.accountId);
        if (newSource) {
          await this.db.accounts.update(input.accountId, { balance: newSource.balance - Math.abs(input.amount), updatedAt: now });
        }
        const newDest = await this.db.accounts.get(input.transferToAccountId);
        if (newDest) {
          await this.db.accounts.update(input.transferToAccountId, { balance: newDest.balance + Math.abs(input.amount), updatedAt: now });
        }
      } else {
        const newAccount = await this.db.accounts.get(input.accountId);
        if (newAccount) {
          await this.db.accounts.update(input.accountId, { balance: newAccount.balance + storedAmount, updatedAt: now });
        }
      }

      await this.db.transactions.put(updated);
    });

    await this.refreshTransactionStreams();
    return updated;
  }

  async getTransactionsByAccount(accountId: string): Promise<Transaction[]> {
    try {
      return await this.db.transactions
        .where('accountId')
        .equals(accountId)
        .filter(t => !t.isDeleted)
        .sortBy('date');
    } catch (error) {
      console.error('Error fetching transactions by account:', error);
      throw new Error('Failed to fetch transactions');
    }
  }

  async getAllTransactions(): Promise<Transaction[]> {
    try {
      const transactions = await this.db.transactions
        .filter(t => !t.isDeleted)
        .toArray();
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this.transactionsSubject.next(transactions);
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw new Error('Failed to fetch transactions');
    }
  }

  async getRecentTransactions(limit = this.recentTransactionsCacheSize): Promise<Transaction[]> {
    try {
      const transactions = await this.db.transactions
        .orderBy('date')
        .reverse()
        .filter((transaction) => !transaction.isDeleted)
        .limit(limit)
        .toArray();

      this.recentTransactionsSubject.next(transactions);
      return transactions;
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      throw new Error('Failed to fetch recent transactions');
    }
  }

  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    try {
      const transactions = await this.db.transactions
        .where('date')
        .between(startDate, endDate, true, true)
        .filter((transaction) => !transaction.isDeleted)
        .toArray();

      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions by date range:', error);
      throw new Error('Failed to fetch transactions for date range');
    }
  }

  getTransactions$(): Observable<Transaction[]> {
    void this.getAllTransactions();
    return this.transactions$;
  }

  getRecentTransactions$(limit = this.recentTransactionsCacheSize): Observable<Transaction[]> {
    void this.getRecentTransactions(Math.max(limit, this.recentTransactionsCacheSize));
    return this.recentTransactions$.pipe(
      map((transactions) => transactions.slice(0, limit))
    );
  }

  async getDirtyTransactions(): Promise<Transaction[]> {
    try {
      return await this.db.transactions
        .filter((transaction) => !!transaction.isDirty)
        .toArray();
    } catch (error) {
      console.error('Error fetching dirty transactions:', error);
      throw new Error('Failed to fetch dirty transactions');
    }
  }

  async clearDirtyFlags(transactionIds: string[]): Promise<void> {
    if (transactionIds.length === 0) {
      return;
    }

    try {
      await this.db.runWithoutDirtyTracking(async () => {
        await this.db.transactions.where('id').anyOf(transactionIds).modify({ isDirty: false });
      });

      await this.refreshTransactionStreams();
    } catch (error) {
      console.error('Error clearing transaction dirty flags:', error);
      throw new Error('Failed to clear transaction dirty flags');
    }
  }

  async upsertFromSheet(transaction: Transaction): Promise<void> {
    try {
      await this.db.runWithoutDirtyTracking(async () => {
        await this.db.transactions.put({
          ...transaction,
          isDirty: false,
          createdBy: transaction.createdBy || GUEST_USER_NAME,
          updatedBy: transaction.updatedBy || transaction.createdBy || GUEST_USER_NAME,
        });
      });

      await this.refreshTransactionStreams();
    } catch (error) {
      console.error('Error upserting transaction from sheet:', error);
      throw new Error('Failed to upsert transaction from sheet');
    }
  }

  private handleError(error: unknown): never {
    console.error('TransactionRepository error:', error);
    throw new Error('Transaction operation failed');
  }

  private async refreshTransactionStreams(): Promise<void> {
    await Promise.all([
      this.getAllTransactions(),
      this.getRecentTransactions(this.recentTransactionsCacheSize)
    ]);
  }
}
