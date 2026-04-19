import { Injectable } from '@angular/core';
import { Category, Transaction } from '../database/models';
import { CategoryRepository, TransactionRepository } from '../database/repositories';

/**
 * Service for auto-categorization based on past transactions.
 */
@Injectable({ providedIn: 'root' })
export class AutoCategorizationService {
  private descriptionCategoryMap = new Map<string, string>();
  private categoriesMap = new Map<string, Category>();
  private initialized = false;

  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  /**
   * Normalize a description for matching: trim and lowercase.
   */
  normalizeDescription(desc: string): string {
    return desc.trim().toLowerCase();
  }

  /**
   * Fetch transactions from the past year and build a normalized description->categoryId map. Also build categoryId->Category map.
   * Only needs to be called once per session.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
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
      this.initialized = true;
    } catch (err) {
      console.error('Failed to build description->category map', err);
    }
  }

  /**
   * Get the category for a given description, or undefined if not found.
   */
  getCategoryForDescription(description: string): Category | undefined {
    const norm = this.normalizeDescription(description);
    const catId = this.descriptionCategoryMap.get(norm);
    if (catId) {
      return this.categoriesMap.get(catId);
    }
    return undefined;
  }
}
