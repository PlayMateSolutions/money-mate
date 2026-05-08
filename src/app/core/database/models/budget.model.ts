import { AuditableEntity } from './common.types';

export type BudgetType = 'category' | 'overall' | 'group' | 'goal';
export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface Budget extends AuditableEntity {
  name: string;
  type: BudgetType;
  amount: number;
  period: BudgetPeriod;
  startDate: Date;
  endDate?: Date;
  categoryIds?: string[];
  groupId?: string;
  rolloverEnabled: boolean;
  alertThresholds: number[];
}