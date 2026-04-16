import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonMenuButton,
  IonButtons,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonNote,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  cloudUploadOutline,
  documentTextOutline,
  refreshOutline,
  warningOutline,
} from 'ionicons/icons';
import {
  CsvImportCommitResult,
  CsvImportInvalidRow,
  CsvImportPreviewResult,
  CsvImportService,
  CsvImportTransactionPreview,
} from '../core/services/csv-import.service';

@Component({
  selector: 'app-transaction-csv-import',
  standalone: true,
  templateUrl: './transaction-csv-import.page.html',
  styleUrls: ['./transaction-csv-import.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonMenuButton,
    IonButtons,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
    IonNote,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionCsvImportPage implements OnInit {
  private readonly currencyKey = 'money-mate-currency';
  private readonly previewDisplayLimit = 500;
  selectedCurrency = 'USD';
  fileName = '';
  processing = false;
  importing = false;
  error: string | null = null;
  preview: CsvImportPreviewResult | null = null;
  importResult: CsvImportCommitResult | null = null;

  constructor(
    private readonly csvImportService: CsvImportService,
    private readonly toastController: ToastController,
    private readonly cdr: ChangeDetectorRef,
  ) {
    addIcons({
      alertCircleOutline,
      checkmarkCircleOutline,
      cloudUploadOutline,
      documentTextOutline,
      refreshOutline,
      warningOutline,
    });
  }

  ngOnInit(): void {
    this.selectedCurrency = localStorage.getItem(this.currencyKey) || 'USD';
  }

  get hasPreview(): boolean {
    return !!this.preview;
  }

  get canImport(): boolean {
    return !!this.preview && this.preview.transactionsToImport.length > 0 && !this.importResult;
  }

  get displayedTransactions(): CsvImportTransactionPreview[] {
    if (!this.preview) {
      return [];
    }

    return this.preview.transactionsToImport.slice(0, this.previewDisplayLimit);
  }

  get hasTruncatedTransactionPreview(): boolean {
    if (!this.preview) {
      return false;
    }

    return this.preview.transactionsToImport.length > this.previewDisplayLimit;
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.processing = true;
    this.error = null;
    this.preview = null;
    this.importResult = null;
    this.fileName = file.name;
    this.cdr.markForCheck();

    try {
      const csvText = await file.text();
      console.log('CSV file content:', csvText);
      this.preview = await this.csvImportService.buildPreview(csvText);
      this.processing = false;
      this.cdr.markForCheck();
      await this.presentToast('CSV processed successfully', 'success');
    } catch (error) {
      console.error('Error processing CSV file:', error);
      this.error = error instanceof Error ? error.message : 'Failed to process the selected CSV file.';
      this.processing = false;
      this.cdr.markForCheck();
      await this.presentToast(this.error, 'danger');
    } finally {
      console.log('CSV file processing completed');
      this.processing = false;
      this.cdr.markForCheck();
      if (input) {
        input.value = '';
      }
    }
  }

  async importTransactions(): Promise<void> {
    if (!this.preview || this.importing || this.importResult) {
      return;
    }

    this.importing = true;
    this.error = null;

    try {
      this.importResult = await this.csvImportService.importPreview(this.preview);
      await this.presentToast(`Imported ${this.importResult.importedCount} transactions`, 'success');
    } catch (error) {
      console.error('Error importing CSV transactions:', error);
      this.error = error instanceof Error ? error.message : 'Failed to import the processed CSV file.';
      await this.presentToast(this.error, 'danger');
    } finally {
      this.importing = false;
    }
  }

  trackByTransactionRow(_: number, transaction: CsvImportTransactionPreview): number {
    return transaction.rowNumber;
  }

  trackByInvalidRow(_: number, row: CsvImportInvalidRow): number {
    return row.rowNumber;
  }

  formatInvalidRow(row: CsvImportInvalidRow): string {
    return row.rawValues.filter((value) => !!value).join(' • ');
  }

  private async presentToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });

    await toast.present();
  }
}
