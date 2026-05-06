import { Routes } from '@angular/router';
import { appEntryGuard } from './core/guards/entry.guard';

export const routes: Routes = [
  {
    path: 'auth/callback',
    loadComponent: () => import('./auth').then((m) => m.LoginPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./auth').then((m) => m.LoginPage),
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./auth').then((m) => m.SheetOnboardingPage),
  },
  {
    path: '',
    canMatch: [appEntryGuard],
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'settings/categories/new',
    loadComponent: () => import('./categories/category-form.page').then((m) => m.CategoryFormPage),
  },
  {
    path: 'settings/categories/:id',
    loadComponent: () => import('./categories/category-form.page').then((m) => m.CategoryFormPage),
  },
  {
    path: 'settings/categories',
    loadComponent: () => import('./categories').then((m) => m.CategoriesPage),
  },
  {
    path: 'settings/accounts',
    loadComponent: () => import('./accounts').then((m) => m.AccountsPage),
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: 'settings/about',
    loadComponent: () => import('./about/about.page').then((m) => m.AboutPage),
  },
  {
    path: 'imports/transactions/csv',
    loadComponent: () => import('./imports').then((m) => m.TransactionCsvImportPage),
  },
  {
    path: 'imports/transactions/quick-add',
    loadComponent: () => import('./imports').then((m) => m.TransactionQuickAddPage),
  },
  {
    path: 'dashboard/customize',
    loadComponent: () => import('./dashboard/dashboard-customize.page').then((m) => m.DashboardCustomizePage),
  },
];
