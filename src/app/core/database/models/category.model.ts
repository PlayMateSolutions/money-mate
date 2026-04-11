import { BaseEntity } from './common.types';

export interface Category extends BaseEntity {
  name: string; // "Food", "Transportation", "Entertainment"
  type?: 'income' | 'expense'; // Optional - transaction amount sign determines income/expense
  color: string; // Hex color for UI (e.g., '#4CAF50')
  icon: string; // Ionic icon name (e.g., 'restaurant-outline')
  sortOrder: number; // Display order
}

// Predefined categories that will be created on first setup
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // General Categories (type determined by transaction amount sign)
  { name: 'Food & Dining', color: '#FF9800', icon: 'restaurant-outline', isDeleted: false, sortOrder: 1 },
  { name: 'Transportation', color: '#2196F3', icon: 'car-outline', isDeleted: false, sortOrder: 2 },
  { name: 'Shopping', color: '#9C27B0', icon: 'bag-outline', isDeleted: false, sortOrder: 3 },
  { name: 'Entertainment', color: '#E91E63', icon: 'game-controller-outline', isDeleted: false, sortOrder: 4 },
  { name: 'Bills & Utilities', color: '#607D8B', icon: 'receipt-outline', isDeleted: false, sortOrder: 5 },
  { name: 'Healthcare', color: '#4CAF50', icon: 'medical-outline', isDeleted: false, sortOrder: 6 },
  { name: 'Salary', color: '#4CAF50', icon: 'card-outline', isDeleted: false, sortOrder: 7 },
  { name: 'Freelance', color: '#8BC34A', icon: 'briefcase-outline', isDeleted: false, sortOrder: 8 },
  { name: 'Investment', color: '#CDDC39', icon: 'trending-up-outline', isDeleted: false, sortOrder: 9 },
];

export type CategoryType = Category['type'];