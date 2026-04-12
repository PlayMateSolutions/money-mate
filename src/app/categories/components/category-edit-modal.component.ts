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
  ModalController
} from '@ionic/angular/standalone';
import { Category } from '../../core/database/models';

export interface CategoryEditModalResult {
  name: string;
  icon: string;
  color: string;
  isActive: boolean;
}

type CategoryModalData = Partial<Category>;

@Component({
  selector: 'app-category-edit-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ category?.id ? 'Edit Category' : 'Create Category' }}</ion-title>
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
          <ion-input [(ngModel)]="form.name" placeholder="Category name"></ion-input>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Icon</ion-label>
          <ion-input [(ngModel)]="form.icon" placeholder="car-outline"></ion-input>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Color</ion-label>
          <div style="display:flex; align-items:center; gap:12px; width:100%;">
            <ion-input
              style="flex:1;"
              [ngModel]="form.color"
              (ngModelChange)="onColorChange($event)"
              placeholder="#2196F3"
            ></ion-input>
            <div
              style="width:20px; height:20px; border-radius:50%; border:1px solid var(--ion-color-medium); flex-shrink:0;"
              [style.background]="form.color || '#ffffff'"
            ></div>
            <ion-button fill="outline" size="small" (click)="regenerateColor()">Generate</ion-button>
          </div>
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
    IonToggle
  ]
})
export class CategoryEditModalComponent implements OnInit {
  @Input() category?: CategoryModalData;

  form: CategoryEditModalResult = {
    name: '',
    icon: '',
    color: '',
    isActive: true
  };

  constructor(private modalController: ModalController) {}

  ngOnInit(): void {
    if (this.category?.id) {
      this.form = {
        name: this.category.name ?? '',
        icon: this.category.icon ?? '',
        color: this.normalizeColor(this.category.color ?? ''),
        isActive: !this.category.isDeleted
      };
      return;
    }

    this.form = {
      name: this.category?.name ?? '',
      icon: this.category?.icon ?? 'pricetag-outline',
      color: this.normalizeColor(this.category?.color ?? '') || this.generateRandomColor(),
      isActive: this.category?.isDeleted !== undefined ? !this.category.isDeleted : true
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
        ...this.form,
        name: this.form.name.trim(),
        icon: this.form.icon.trim(),
        color: this.normalizeColor(this.form.color)
      },
      'save'
    );
  }
}
