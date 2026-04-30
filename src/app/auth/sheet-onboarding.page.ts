import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addCircleOutline, documentOutline, ellipsisHorizontalOutline, logOutOutline } from 'ionicons/icons';
import { Router } from '@angular/router';
import { GoogleSheetService, SessionService } from '../core/services';
import { environment } from '../../environments/environment';
import '@googleworkspace/drive-picker-element';

interface PickerDoc {
  id: string;
  name: string;
}

interface SpreadsheetOption {
  id: string;
  name: string;
  linked?: boolean;
}

@Component({
  selector: 'app-sheet-onboarding',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './sheet-onboarding.page.html',
  styleUrls: ['./sheet-onboarding.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonText,
    IonItem,
    IonLabel,
    IonList,
  ],
})
export class SheetOnboardingPage implements OnInit {
  loading = false;
  loadingSpreadsheets = false;
  pickerVisible = false;
  showSpreadsheetList = false;
  showMainOptions = false;
  oauthToken = '';
  clientId = environment.googleSignInClientId;
  appId = environment.googleProjectNumber;
  existingSpreadsheets: SpreadsheetOption[] = [];

  constructor(
    private readonly sessionService: SessionService,
    private readonly googleSheetService: GoogleSheetService,
    private readonly router: Router,
    private readonly toastController: ToastController,
  ) {
    addIcons({ addCircleOutline, documentOutline, ellipsisHorizontalOutline, logOutOutline });
  }

  async ngOnInit(): Promise<void> {
    const session = this.sessionService.currentSession;
    this.oauthToken = session?.accessToken || '';

    if (!this.oauthToken) {
      void this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    await this.fetchExistingSpreadsheets();
  }

  async fetchExistingSpreadsheets(): Promise<void> {
    const accessToken = this.sessionService.currentSession?.accessToken;
    if (!accessToken) {
      this.showMainOptions = true;
      return;
    }

    this.loadingSpreadsheets = true;
    try {
      const linked = this.sessionService.linkedSpreadsheet;
      const files = await this.googleSheetService.listUserSpreadsheets();

      if (linked?.id) {
        const linkedEntry: SpreadsheetOption = {
          id: linked.id,
          name: linked.name,
          linked: true,
        };

        const withoutDuplicate = files.filter((file) => file.id !== linked.id);
        this.existingSpreadsheets = [linkedEntry, ...withoutDuplicate];
      } else {
        this.existingSpreadsheets = files;
      }

      if (this.existingSpreadsheets.length > 0) {
        this.showSpreadsheetList = true;
        this.showMainOptions = false;
      } else {
        this.showSpreadsheetList = false;
        this.showMainOptions = true;
      }
    } catch (error) {
      console.error('Failed to fetch existing spreadsheets:', error);
      const linked = this.sessionService.linkedSpreadsheet;
      this.existingSpreadsheets = linked ? [{ id: linked.id, name: linked.name, linked: true }] : [];
      this.showSpreadsheetList = this.existingSpreadsheets.length > 0;
      this.showMainOptions = !this.showSpreadsheetList;
    } finally {
      this.loadingSpreadsheets = false;
    }
  }

  async selectExistingSpreadsheet(spreadsheet: SpreadsheetOption): Promise<void> {
    this.loading = true;
    try {
      this.sessionService.setLinkedSpreadsheet({
        id: spreadsheet.id,
        name: spreadsheet.name,
      });

      await this.googleSheetService.importAllFromSheetToLocal();
      await this.showToast('Spreadsheet linked and data imported', 'success');
      await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
    } catch (error) {
      console.error('Failed to import sheet data:', error);
      await this.showToast('Unable to import data from sheet', 'danger');
    } finally {
      this.loading = false;
    }
  }

  proceedToChooseCreate(): void {
    this.showSpreadsheetList = false;
    this.showMainOptions = true;
  }

  async createNewSheet(): Promise<void> {
    const accessToken = this.sessionService.currentSession?.accessToken;
    if (!accessToken) {
      await this.showToast('Please sign in again', 'danger');
      await this.router.navigate(['/login']);
      return;
    }

    this.loading = true;
    try {
      const title = `MoneyMate | ${this.sessionService.currentSession?.name || 'My Account'}`;
      const spreadsheet = await this.googleSheetService.createMoneyMateSpreadsheet(title);

      this.sessionService.setLinkedSpreadsheet(spreadsheet);

      await this.showToast('Sheet created successfully', 'success');
      await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
    } catch (error) {
      console.error('Create sheet failed:', error);
      await this.showToast('Unable to create sheet. Please try again.', 'danger');
    } finally {
      this.loading = false;
    }
  }

  openPicker(): void {
    this.pickerVisible = true;
  }

  async onDrivePicked(event: Event): Promise<void> {
    const pickerEvent = event as CustomEvent<{ docs: PickerDoc[] }>;
    const selectedDoc = pickerEvent.detail?.docs?.[0];
    if (!selectedDoc?.id) {
      return;
    }

    this.loading = true;
    try {
      this.sessionService.setLinkedSpreadsheet({
        id: selectedDoc.id,
        name: selectedDoc.name,
      });

      await this.googleSheetService.importAllFromSheetToLocal();
      await this.showToast('Spreadsheet linked and data imported', 'success');
      await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
    } catch (error) {
      console.error('Failed to import picked sheet data:', error);
      await this.showToast('Unable to import data from sheet', 'danger');
    } finally {
      this.loading = false;
    }
  }

  async skipForNow(): Promise<void> {
    await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
  }

  async logout(): Promise<void> {
    await this.sessionService.signOutGoogle();
    await this.router.navigate(['/login'], { replaceUrl: true });
  }

  private async showToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
