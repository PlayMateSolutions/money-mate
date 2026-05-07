import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonAvatar,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { openOutline, personCircleOutline } from 'ionicons/icons';
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
  hasPermissionData = false;
  userPermissions: GoogleDriveFilePermission[] = [];

  private destroy$ = new Subject<void>();
  private lastLoadedSheetId: string | null = null;
  private failedAvatarIds = new Set<string>();

  constructor(
    private readonly sessionService: SessionService,
    private readonly googleSheetsDbService: GoogleSheetsDbService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    addIcons({ openOutline, personCircleOutline });
  }

  ngOnInit(): void {
    this.sessionService.session$
      .pipe(takeUntil(this.destroy$))
      .subscribe((session) => {
        this.authMode = session?.mode ?? 'none';

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
    this.cdr.markForCheck();

    try {
      const details = await this.googleSheetsDbService.getSpreadsheetDetails(sheetId);
      this.linkedSheetName = details.name || this.linkedSheetName;
      this.isShared = details.shared;
      this.isStarred = details.starred;
      this.userPermissions = details.permissions.filter((permission) => permission.type === 'user');
      this.hasPermissionData = true;
    } catch {
      this.hasPermissionData = false;
      this.userPermissions = [];
    } finally {
      this.loadingPermissions = false;
      this.cdr.markForCheck();
    }
  }

  private resetPermissionsState(): void {
    this.lastLoadedSheetId = null;
    this.loadingPermissions = false;
    this.hasPermissionData = false;
    this.userPermissions = [];
    this.failedAvatarIds.clear();
    this.isShared = false;
    this.isStarred = false;
  }
}
