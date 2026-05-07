import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertController,
  IonAvatar,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonItemGroup,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, openOutline, personCircleOutline, trashOutline } from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import {
  AuthMode,
  GoogleDriveFilePermission,
  GoogleSheetsDbService,
  SessionService,
} from '../core/services';

@Component({
  selector: 'app-linked-sheet',
  standalone: true,
  templateUrl: './linked-sheet.page.html',
  styleUrls: ['./linked-sheet.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonList,
    IonItemGroup,
    IonItemDivider,
    IonAvatar,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkedSheetPage implements OnInit, OnDestroy {
  authMode: AuthMode | 'none' = 'none';
  linkedSheetId: string | null = null;
  linkedSheetName: string | null = null;
  isShared = false;
  isStarred = false;
  loadingPermissions = false;
  accessActionInProgress = false;
  hasPermissionData = false;
  currentUserEmail = '';
  isCurrentUserOwner = false;
  userPermissions: GoogleDriveFilePermission[] = [];

  private destroy$ = new Subject<void>();
  private lastLoadedSheetId: string | null = null;
  private failedAvatarIds = new Set<string>();

  constructor(
    private readonly sessionService: SessionService,
    private readonly googleSheetsDbService: GoogleSheetsDbService,
    private readonly cdr: ChangeDetectorRef,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController,
  ) {
    addIcons({ addOutline, openOutline, personCircleOutline, trashOutline });
  }

  ngOnInit(): void {
    this.sessionService.session$
      .pipe(takeUntil(this.destroy$))
      .subscribe((session) => {
        this.authMode = session?.mode ?? 'none';
        this.currentUserEmail = (session?.email || '').toLowerCase();

        const linkedSpreadsheet = this.sessionService.linkedSpreadsheet;
        this.linkedSheetId = linkedSpreadsheet?.id || null;
        this.linkedSheetName = linkedSpreadsheet?.name || null;

        if (!this.linkedSheetId || this.authMode !== 'google') {
          this.resetPermissionsState();
          this.cdr.markForCheck();
          return;
        }

        if (this.lastLoadedSheetId === this.linkedSheetId) {
          this.cdr.markForCheck();
          return;
        }

        this.lastLoadedSheetId = this.linkedSheetId;
        void this.loadSheetDetails(this.linkedSheetId);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openLinkedSheet(): void {
    if (!this.linkedSheetId) {
      return;
    }

    window.open(`https://docs.google.com/spreadsheets/d/${this.linkedSheetId}/edit`, '_blank', 'noopener');
  }

  trackByPermissionId(_: number, permission: GoogleDriveFilePermission): string {
    return permission.id;
  }

  get canManageAccess(): boolean {
    return this.authMode === 'google' && this.isCurrentUserOwner;
  }

  canRemovePermission(permission: GoogleDriveFilePermission): boolean {
    if (!this.canManageAccess) {
      return false;
    }

    if (permission.role === 'owner') {
      return false;
    }

    const permissionEmail = (permission.emailAddress || '').toLowerCase();
    if (permissionEmail && permissionEmail === this.currentUserEmail) {
      return false;
    }

    return true;
  }

  async openAddAccessPrompt(): Promise<void> {
    if (!this.canManageAccess || !this.linkedSheetId || this.accessActionInProgress) {
      return;
    }

    const emailAlert = await this.alertController.create({
      header: 'Grant Access',
      message: 'Enter the user email address',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'user@gmail.com',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Next',
          role: 'confirm',
        },
      ],
    });

    await emailAlert.present();
    const emailResult = await emailAlert.onDidDismiss<{ values?: { email?: string } }>();
    if (emailResult.role !== 'confirm') {
      return;
    }

    const emailAddress = (emailResult.data?.values?.email || '').trim().toLowerCase();
    if (!this.isValidEmail(emailAddress)) {
      await this.presentToast('Enter a valid email address', 'danger');
      return;
    }

    await this.grantAccess(emailAddress);
  }

  async confirmRemovePermission(permission: GoogleDriveFilePermission): Promise<void> {
    if (!this.linkedSheetId || !this.canRemovePermission(permission) || this.accessActionInProgress) {
      return;
    }

    const targetLabel = permission.emailAddress || permission.displayName || 'this user';
    const alert = await this.alertController.create({
      header: 'Remove Access',
      message: `Remove access for ${targetLabel}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Remove',
          role: 'destructive',
          handler: () => {
            void this.removeAccess(permission);
          },
        },
      ],
    });

    await alert.present();
  }

  onAvatarLoadError(permissionId: string): void {
    if (this.failedAvatarIds.has(permissionId)) {
      return;
    }

    this.failedAvatarIds.add(permissionId);
    this.userPermissions = this.userPermissions.map((permission) => {
      if (permission.id !== permissionId) {
        return permission;
      }

      return {
        ...permission,
        photoLink: undefined,
      };
    });
    this.cdr.markForCheck();
  }

  private async loadSheetDetails(sheetId: string): Promise<void> {
    this.loadingPermissions = true;
    this.hasPermissionData = false;
    this.userPermissions = [];
    this.failedAvatarIds.clear();
    this.isCurrentUserOwner = false;
    this.cdr.markForCheck();

    try {
      const details = await this.googleSheetsDbService.getSpreadsheetDetails(sheetId);
      this.linkedSheetName = details.name || this.linkedSheetName;
      this.isShared = details.shared;
      this.isStarred = details.starred;
      this.userPermissions = details.permissions.filter((permission) => permission.type === 'user');
      this.isCurrentUserOwner = this.userPermissions.some((permission) => {
        const permissionEmail = (permission.emailAddress || '').toLowerCase();
        return permission.role === 'owner' && !!permissionEmail && permissionEmail === this.currentUserEmail;
      });
      this.hasPermissionData = true;
    } catch {
      this.hasPermissionData = false;
      this.userPermissions = [];
      this.isCurrentUserOwner = false;
    } finally {
      this.loadingPermissions = false;
      this.cdr.markForCheck();
    }
  }

  private async grantAccess(emailAddress: string): Promise<void> {
    if (!this.linkedSheetId) {
      return;
    }

    this.accessActionInProgress = true;
    this.cdr.markForCheck();

    try {
      await this.googleSheetsDbService.createFilePermission(emailAddress, {
        spreadsheetId: this.linkedSheetId,
        sendNotificationEmail: false,
      });
      await this.presentToast('Write access granted successfully', 'success');
      await this.loadSheetDetails(this.linkedSheetId);
    } catch (error) {
      await this.presentToast(this.getShareErrorMessage(error, 'grant'), 'danger');
    } finally {
      this.accessActionInProgress = false;
      this.cdr.markForCheck();
    }
  }

  private async removeAccess(permission: GoogleDriveFilePermission): Promise<void> {
    if (!this.linkedSheetId || !this.canRemovePermission(permission)) {
      return;
    }

    this.accessActionInProgress = true;
    this.cdr.markForCheck();

    try {
      await this.googleSheetsDbService.deleteFilePermission(permission.id, this.linkedSheetId);
      await this.presentToast('Access removed successfully', 'success');
      await this.loadSheetDetails(this.linkedSheetId);
    } catch (error) {
      await this.presentToast(this.getShareErrorMessage(error, 'remove'), 'danger');
    } finally {
      this.accessActionInProgress = false;
      this.cdr.markForCheck();
    }
  }

  private isValidEmail(emailAddress: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
  }

  private getShareErrorMessage(error: unknown, action: 'grant' | 'remove'): string {
    const status = this.extractStatusCode(error);
    if (status === 403) {
      return 'Permission denied. Reconnect Google or relink a sheet with proper access.';
    }

    if (status === 400) {
      return action === 'grant'
        ? 'Invalid request. Check the email address and selected role.'
        : 'Invalid remove request.';
    }

    if (status === 404) {
      return action === 'grant'
        ? 'Sheet not found. Please relink your spreadsheet.'
        : 'Permission not found or already removed.';
    }

    return action === 'grant' ? 'Failed to grant access' : 'Failed to remove access';
  }

  private extractStatusCode(error: unknown): number | null {
    if (!(error instanceof Error)) {
      return null;
    }

    const match = error.message.match(/\((\d{3})\)/);
    if (!match?.[1]) {
      return null;
    }

    return Number(match[1]);
  }

  private async presentToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  private resetPermissionsState(): void {
    this.lastLoadedSheetId = null;
    this.loadingPermissions = false;
    this.accessActionInProgress = false;
    this.hasPermissionData = false;
    this.currentUserEmail = '';
    this.isCurrentUserOwner = false;
    this.userPermissions = [];
    this.failedAvatarIds.clear();
    this.isShared = false;
    this.isStarred = false;
  }
}
