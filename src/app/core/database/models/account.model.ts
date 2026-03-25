import { BaseEntity } from './common.types';

export interface Account extends BaseEntity {
  name: string; // "Chase Checking", "Visa Credit Card"
  type: 'checking' | 'savings' | 'credit' | 'cash';
  balance: number; // Current balance
  ownerName: string; // Account owner name
  color: string; // UI color for visual identification
  icon: string; // Icon name for the account type
  notes?: string; // Optional description
}

export type AccountType = Account['type'];