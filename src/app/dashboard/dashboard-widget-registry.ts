import { Type } from '@angular/core';
import { AccountBalanceCarouselComponent } from './widgets/account-balance-carousel/account-balance-carousel.component';
import { ExpenseBreakdownWidgetComponent } from './widgets/expense-breakdown/expense-breakdown-widget.component';
import { RecentTransactionsWidgetComponent } from './widgets/recent-transactions/recent-transactions-widget.component';

export type DashboardWidgetId =
  | 'top-summary'
  | 'expense-breakdown'
  | 'recent-transactions';

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  title: string;
  subtitle: string;
  component: Type<unknown>;
}

export const DASHBOARD_WIDGET_DEFINITIONS: DashboardWidgetDefinition[] = [
  {
    id: 'top-summary',
    title: 'Account Balance',
    subtitle: 'All your account balances',
    component: AccountBalanceCarouselComponent
  },
  {
    id: 'expense-breakdown',
    title: 'Expense Breakdown',
    subtitle: 'Category-wise expense overview',
    component: ExpenseBreakdownWidgetComponent
  },
  {
    id: 'recent-transactions',
    title: 'Recent Transactions',
    subtitle: 'Latest 5 to 10 transactions',
    component: RecentTransactionsWidgetComponent
  }
];

export const DASHBOARD_WIDGET_BY_ID = new Map<DashboardWidgetId, DashboardWidgetDefinition>(
  DASHBOARD_WIDGET_DEFINITIONS.map((widget) => [widget.id, widget])
);
