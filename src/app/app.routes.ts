import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
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
