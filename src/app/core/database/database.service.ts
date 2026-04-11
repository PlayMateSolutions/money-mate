import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Account, Category, Transaction } from './models';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService extends Dexie {
  // Tables
  accounts!: Table<Account>;
  categories!: Table<Category>;
  transactions!: Table<Transaction>;

  constructor() {
    super('MoneyMateDB');
    console.log('Initializing database schema... ');
    
    this.version(1).stores({
      accounts: '++id, name, type, ownerName, createdAt',
      categories: '++id, name, sortOrder, createdAt',
      transactions: '++id, accountId, categoryId, date, type, amount, createdAt, createdBy'
    });

    // Initialize default categories on first run - using transaction approach like React example
    this.on('ready', async () => {
      console.log('Database ready event fired');
      await this.initializeDefaultData();
      return true; // Important: return true or a promise for Dexie
    });

    // Force database open to ensure initialization (similar to React example)
    this.open().catch(err => {
      console.error('Failed to open database:', err);
    });
  }

  private async initializeDefaultData(): Promise<void> {
    try {
      console.log('Checking for existing categories...');
      // Check if categories already exist
      const categoryCount = await this.categories.count();
      
      if (categoryCount === 0) {
        // Import default categories
        const { DEFAULT_CATEGORIES } = await import('./models/category.model');
        
        // Add default categories with proper IDs and timestamps
        const categoriesWithMetadata = DEFAULT_CATEGORIES.map(category => ({
          ...category,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        await this.categories.bulkAdd(categoriesWithMetadata);
        console.log('Default categories initialized successfully');
      }
    } catch (error) {
      console.error('Error initializing default data:', error);
    }
  }

  /**
   * Clear all data (useful for development/testing)
   */
  async clearAllData(): Promise<void> {
    await this.transaction('rw', this.accounts, this.categories, this.transactions, async () => {
      await this.accounts.clear();
      await this.categories.clear(); 
      await this.transactions.clear();
    });
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{ accounts: number; categories: number; transactions: number }> {
    const [accounts, categories, transactions] = await Promise.all([
      this.accounts.filter(account => !account.isDeleted).count(),
      this.categories.filter(category => !category.isDeleted).count(),
      this.transactions.filter(transaction => !transaction.isDeleted).count()
    ]);

    return { accounts, categories, transactions };
  }
}