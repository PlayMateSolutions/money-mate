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
import { SessionService } from '../core/services';
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
      const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
      const fields = encodeURIComponent('files(id,name,modifiedTime)');
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=25`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const files: SpreadsheetOption[] = [];

      if (response.ok) {
        const data = await response.json() as { files?: Array<{ id: string; name: string }> };
        const mapped = (data.files || [])
          .filter((file) => !!file.id)
          .map((file) => ({
            id: file.id,
            name: file.name || 'Untitled Spreadsheet',
          }));
        files.push(...mapped);
      }

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
    this.sessionService.setLinkedSpreadsheet({
      id: spreadsheet.id,
      name: spreadsheet.name,
    });
    await this.showToast('Spreadsheet linked successfully', 'success');
    await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
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
      const title = `Money Mate | ${new Date().toISOString().slice(0, 10)}`;
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title },
          sheets: [
            { properties: { title: 'accounts' } },
            { properties: { title: 'categories' } },
            { properties: { title: 'transactions' } },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create sheet (${response.status})`);
      }

      const data = await response.json() as { spreadsheetId: string; properties?: { title?: string } };
      this.sessionService.setLinkedSpreadsheet({
        id: data.spreadsheetId,
        name: data.properties?.title || title,
      });

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

    this.sessionService.setLinkedSpreadsheet({
      id: selectedDoc.id,
      name: selectedDoc.name,
    });

    await this.showToast('Spreadsheet linked successfully', 'success');
    await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
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
