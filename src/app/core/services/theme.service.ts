import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type Theme = 'auto' | 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'money-mate-theme';
  private themeSubject = new BehaviorSubject<Theme>('auto');
  
  constructor() {
    this.initializeTheme();
    this.setupSystemThemeListener();
  }

  get theme$(): Observable<Theme> {
    return this.themeSubject.asObservable();
  }

  get currentTheme(): Theme {
    return this.themeSubject.value;
  }

  setTheme(theme: Theme): void {
    this.themeSubject.next(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.applyTheme(theme);
  }

  private initializeTheme(): void {
    const savedTheme = localStorage.getItem(this.THEME_KEY) as Theme;
    const theme = savedTheme || 'auto';
    this.themeSubject.next(theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: Theme): void {
    const body = document.body;
    
    // Remove existing theme classes
    body.classList.remove('dark');
    
    if (theme === 'dark') {
      body.classList.add('dark');
    } else if (theme === 'auto') {
      // Apply dark theme if system preference is dark
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        body.classList.add('dark');
      }
    }
    // For 'light' theme, no class is added (default is light)
  }

  private setupSystemThemeListener(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    mediaQuery.addEventListener('change', () => {
      // Only react to system changes if theme is set to 'auto'
      if (this.currentTheme === 'auto') {
        this.applyTheme('auto');
      }
    });
  }

  isDarkMode(): boolean {
    if (this.currentTheme === 'dark') return true;
    if (this.currentTheme === 'light') return false;
    // For 'auto', check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}