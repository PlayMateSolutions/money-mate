import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('../transactions/transactions.page').then((m) => m.TransactionsPage),
      },
      {
        path: 'transactions/form',
        loadComponent: () =>
          import('../transactions/transaction-form.page').then((m) => m.TransactionFormPage),
      },
      {
        path: 'transactions/form/:id',
        loadComponent: () =>
          import('../transactions/transaction-form.page').then((m) => m.TransactionFormPage),
      },
      {
        path: '',
        redirectTo: '/tabs/dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/dashboard',
    pathMatch: 'full',
  },
];
