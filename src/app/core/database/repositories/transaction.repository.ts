import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DatabaseService } from '../database.service';
import { Transaction, TransactionType } from '../models';

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

@Injectable({
  providedIn: 'root'
})
export class TransactionRepository {
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  public transactions$ = this.transactionsSubject.asObservable();

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
      createdBy: 'user'
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

    await this.getAllTransactions();

    return transaction;
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

  getTransactions$(): Observable<Transaction[]> {
    this.getAllTransactions();
    return this.transactions$;
  }

  private handleError(error: unknown): never {
    console.error('TransactionRepository error:', error);
    throw new Error('Transaction operation failed');
  }
}
