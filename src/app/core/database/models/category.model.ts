import { BaseEntity } from './common.types';

export interface Category extends BaseEntity {
  name: string; // "Food", "Transportation", "Entertainment"
  type: 'income' | 'expense';
  color: string; // Hex color for UI (e.g., '#4CAF50')
  icon: string; // Ionic icon name (e.g., 'restaurant-outline')
  sortOrder: number; // Display order
}

// Predefined categories that will be created on first setup
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Expense Categories
  { name: 'Food & Dining', type: 'expense', color: '#FF9800', icon: 'restaurant-outline', isDeleted: false, sortOrder: 1 },
  { name: 'Transportation', type: 'expense', color: '#2196F3', icon: 'car-outline', isDeleted: false, sortOrder: 2 },
  { name: 'Shopping', type: 'expense', color: '#9C27B0', icon: 'bag-outline', isDeleted: false, sortOrder: 3 },
  { name: 'Entertainment', type: 'expense', color: '#E91E63', icon: 'game-controller-outline', isDeleted: false, sortOrder: 4 },
  { name: 'Bills & Utilities', type: 'expense', color: '#607D8B', icon: 'receipt-outline', isDeleted: false, sortOrder: 5 },
  { name: 'Healthcare', type: 'expense', color: '#4CAF50', icon: 'medical-outline', isDeleted: false, sortOrder: 6 },
  
  // Income Categories  
  { name: 'Salary', type: 'income', color: '#4CAF50', icon: 'card-outline', isDeleted: false, sortOrder: 10 },
  { name: 'Freelance', type: 'income', color: '#8BC34A', icon: 'briefcase-outline', isDeleted: false, sortOrder: 11 },
  { name: 'Investment', type: 'income', color: '#CDDC39', icon: 'trending-up-outline', isDeleted: false, sortOrder: 12 },
];

export type CategoryType = Category['type'];