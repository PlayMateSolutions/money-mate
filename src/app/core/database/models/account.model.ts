import { AuditableEntity } from './common.types';

export interface Account extends AuditableEntity {
  name: string; // "Chase Checking", "Visa Credit Card"
  type: 'checking' | 'savings' | 'credit' | 'cash';
  balance: number; // Current balance
  ownerName: string; // Account owner name
  color: string; // UI color for visual identification
  icon: string; // Icon name for the account type
  notes?: string; // Optional description
}

export type AccountType = Account['type'];

// Predefined accounts that will be created on first setup
export const DEFAULT_ACCOUNTS: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isDirty'>[] = [
  {
    name: 'Cash',
    type: 'cash',
    balance: 0,
    ownerName: 'Me',
    color: '#FFB300',
    icon: 'cash-outline',
    isDeleted: false,
    notes: 'Default cash account'
  }
];