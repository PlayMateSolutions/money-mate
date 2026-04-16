import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { helpCircleOutline } from 'ionicons/icons';
import { Account } from '../core/database/models';
import { AccountRepository } from '../core/database/repositories';

@Component({
  selector: 'app-transaction-quick-add',
  standalone: true,
  templateUrl: './transaction-quick-add.page.html',
  styleUrls: ['./transaction-quick-add.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonNote,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionQuickAddPage implements OnInit {
  accounts: Account[] = [];
  selectedAccountId = '';
  quickEntryText = '';
  loadingAccounts = false;
  error: string | null = null;

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly alertController: AlertController,
    private readonly cdr: ChangeDetectorRef,
  ) {
    addIcons({
      helpCircleOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadAccounts();
  }

  get canPreview(): boolean {
    return !!this.selectedAccountId && !!this.quickEntryText.trim();
  }

  async loadAccounts(): Promise<void> {
    this.loadingAccounts = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      this.accounts = await this.accountRepository.getAccountsForSettings();
    } catch (error) {
      console.error('Error loading accounts for quick add:', error);
      this.error = error instanceof Error ? error.message : 'Failed to load accounts.';
    } finally {
      this.loadingAccounts = false;
      this.cdr.markForCheck();
    }
  }

  onFormChanged(): void {
  }

  previewQuickAdd(): void {
    if (!this.canPreview) {
      return;
    }
  }

  async showHelp(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Quick Add Help',
      message: 'Enter one transaction per line. Example:\n\n14 Milk 32\n15 Tea 12\n1 Petrol 200\n\nIf a line starts with a number, it will be treated as the day in the current month. If no day is given, today will be used. The selected account applies to every line.',
      buttons: ['OK'],
    });

    await alert.present();
  }

  trackByAccount(_: number, account: Account): string {
    return account.id;
  }
}
