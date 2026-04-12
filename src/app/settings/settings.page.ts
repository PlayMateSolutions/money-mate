import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonMenuButton,
  IonList,
  IonItem,
  IonItemGroup,
  IonItemDivider,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonNote,
  IonAvatar,
  IonButton
} from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';
import { ThemeService, Theme, SessionService, AuthMode } from '../core/services';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, logOutOutline, personCircleOutline, logoGoogle, openOutline } from 'ionicons/icons';
import { Router } from '@angular/router';

@Component({
  selector: 'app-settings',
  templateUrl: 'settings.page.html',
  styleUrls: ['settings.page.scss'],
  imports: [
    CommonModule,
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    IonMenuButton,
    IonList,
    IonItem,
    IonItemGroup,
    IonItemDivider,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonNote,
    IonAvatar,
    IonButton
  ]
})
export class SettingsPage implements OnInit, OnDestroy {
  currentTheme: Theme = 'auto';
  authMode: AuthMode | 'none' = 'none';
  userName = 'Guest User';
  userEmail = 'Offline Mode';
  userPicture = '';
  accountSubtitle = 'Connect Google to enable sync and backup';
  linkedSheetId: string | null = null;
  linkedSheetName: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private themeService: ThemeService,
    private sessionService: SessionService,
    private router: Router
  ) {
    addIcons({ chevronForwardOutline, logOutOutline, personCircleOutline, logoGoogle, openOutline });
  }

  ngOnInit() {
    // this.themeService.theme$
    //   .pipe(takeUntil(this.destroy$))
    //   .subscribe(theme => {
    //     this.currentTheme = theme;
    //   });

    this.sessionService.session$
      .pipe(takeUntil(this.destroy$))
      .subscribe((session) => {
        this.authMode = session?.mode ?? 'none';
        this.userName = session?.name || 'Guest User';
        this.userEmail = session?.email || 'Offline Mode';
        this.userPicture = session?.picture || '';
        this.linkedSheetId = this.sessionService.linkedSpreadsheet?.id || null;
        this.linkedSheetName = this.sessionService.linkedSpreadsheet?.name || null;
        this.accountSubtitle = this.authMode === 'google'
          ? 'Google Account'
          : 'Connect Google to enable sync and backup';
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onThemeChange(event: any) {
    const theme = event.detail.value as Theme;
    this.themeService.setTheme(theme);
  }

  async openCategoryManagement(): Promise<void> {
    await this.router.navigate(['/settings/categories']);
  }

  async openAccountManagement(): Promise<void> {
    await this.router.navigate(['/settings/accounts']);
  }

  async openLogin(): Promise<void> {
    await this.router.navigate(['/login']);
  }

  async manageLinkedSheet(): Promise<void> {
    if (this.authMode === 'google') {
      await this.router.navigate(['/onboarding']);
      return;
    }

    await this.openLogin();
  }

  openLinkedSheet(): void {
    if (!this.linkedSheetId) {
      return;
    }

    window.open(`https://docs.google.com/spreadsheets/d/${this.linkedSheetId}/edit`, '_blank', 'noopener');
  }

  async disconnectGoogle(): Promise<void> {
    await this.sessionService.signOutGoogle();
  }

  async logout(): Promise<void> {
    await this.disconnectGoogle();
  }
}