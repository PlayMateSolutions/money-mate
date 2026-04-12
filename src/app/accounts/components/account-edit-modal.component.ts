import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonToggle,
  IonSelect,
  IonSelectOption,
  ModalController
} from '@ionic/angular/standalone';
import { Account, AccountType } from '../../core/database/models';

export interface AccountEditModalResult {
  name: string;
  type: AccountType;
  ownerName: string;
  color: string;
  icon: string;
  isActive: boolean;
}

@Component({
  selector: 'app-account-edit-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ account ? 'Edit Account' : 'Create Account' }}</ion-title>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">Cancel</ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button [disabled]="!canSave" (click)="save()">Save</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
        <ion-item>
          <ion-label position="stacked">Name *</ion-label>
          <ion-input [(ngModel)]="form.name" placeholder="Account name"></ion-input>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Type</ion-label>
          <ion-select [(ngModel)]="form.type">
            <ion-select-option value="cash">Cash</ion-select-option>
            <ion-select-option value="checking">Checking</ion-select-option>
            <ion-select-option value="savings">Savings</ion-select-option>
            <ion-select-option value="credit">Credit</ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Owner Name</ion-label>
          <ion-input [(ngModel)]="form.ownerName" placeholder="Account owner"></ion-input>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Color</ion-label>
          <div style="display:flex; align-items:center; gap:12px; width:100%;">
            <ion-input
              style="flex:1;"
              [ngModel]="form.color"
              (ngModelChange)="onColorChange($event)"
              placeholder="#FFB300"
            ></ion-input>
            <div
              style="width:20px; height:20px; border-radius:50%; border:1px solid var(--ion-color-medium); flex-shrink:0;"
              [style.background]="form.color || '#ffffff'"
            ></div>
            <ion-button fill="outline" size="small" (click)="regenerateColor()">Generate</ion-button>
          </div>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Icon</ion-label>
          <ion-input [(ngModel)]="form.icon" placeholder="cash-outline"></ion-input>
        </ion-item>

        <ion-item>
          <ion-label>IsActive</ion-label>
          <ion-toggle [(ngModel)]="form.isActive" slot="end"></ion-toggle>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonToggle,
    IonSelect,
    IonSelectOption
  ]
})
export class AccountEditModalComponent implements OnInit {
  @Input() account?: Partial<Account>;

  form: AccountEditModalResult = {
    name: '',
    type: 'savings',
    ownerName: '',
    color: '',
    icon: '',
    isActive: true
  };

  constructor(private modalController: ModalController) {}

  ngOnInit(): void {
    if (this.account?.id) {
      this.form = {
        name: this.account.name ?? '',
        type: this.account.type ?? 'savings',
        ownerName: this.account.ownerName ?? '',
        color: this.normalizeColor(this.account.color ?? ''),
        icon: this.account.icon ?? '',
        isActive: !this.account.isDeleted
      };
      return;
    }

    this.form = {
      name: this.account?.name ?? '',
      type: this.account?.type ?? 'savings',
      ownerName: this.account?.ownerName ?? '',
      color: this.normalizeColor(this.account?.color ?? '') || this.generateRandomColor(),
      icon: this.account?.icon ?? '',
      isActive: this.account?.isDeleted !== undefined ? !this.account.isDeleted : true
    };
  }

  private generateRandomColor(): string {
    return ('#' + ((Math.random() * 0xFFFFFF) << 0).toString(16).padStart(6, '0')).toUpperCase();
  }

  private normalizeColor(value: string): string {
    return value.trim().toUpperCase();
  }

  onColorChange(value: string | number | null | undefined): void {
    this.form.color = this.normalizeColor(String(value ?? ''));
  }

  regenerateColor(): void {
    this.form.color = this.generateRandomColor();
  }

  get canSave(): boolean {
    return this.form.name.trim().length > 0;
  }

  async cancel(): Promise<void> {
    await this.modalController.dismiss(undefined, 'cancel');
  }

  async save(): Promise<void> {
    if (!this.canSave) {
      return;
    }

    await this.modalController.dismiss(
      {
        name: this.form.name.trim(),
        type: this.form.type,
        ownerName: this.form.ownerName.trim(),
        color: this.normalizeColor(this.form.color),
        icon: this.form.icon.trim(),
        isActive: this.form.isActive
      },
      'save'
    );
  }
}
