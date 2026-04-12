import { Routes } from '@angular/router';
import { appEntryGuard } from './core/guards/entry.guard';

export const routes: Routes = [
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
];
