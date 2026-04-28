import { TransactionRepository } from '../../../core/database/repositories/transaction.repository';
import { Transaction } from '../../../core/database/models/transaction.model';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AccountLastEntryService {
  constructor(private transactionRepository: TransactionRepository) {}

  async getLastEntryDate(accountId: string): Promise<Date | null> {
    const transactions = await this.transactionRepository.queryTransactions(
      { accountIds: [accountId] },
      { sortDirection: 'desc', limit: 1 }
    );
    if (transactions.length === 0) return null;
    return new Date(transactions[0].date);
  }
}
