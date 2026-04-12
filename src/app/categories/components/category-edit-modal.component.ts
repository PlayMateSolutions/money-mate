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

@Component({
  selector: 'app-category-edit-modal',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ category ? 'Edit Category' : 'Create Category' }}</ion-title>
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
          <ion-label position="stacked">Name</ion-label>
          <ion-input [(ngModel)]="form.name" placeholder="Category name"></ion-input>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Icon</ion-label>
          <ion-input [(ngModel)]="form.icon" placeholder="car-outline"></ion-input>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Color</ion-label>
          <ion-input [(ngModel)]="form.color" placeholder="#2196F3"></ion-input>
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
  @Input() category?: Category;

  form: CategoryEditModalResult = {
    name: '',
    icon: '',
    color: '',
    isActive: true
  };

  constructor(private modalController: ModalController) {}

  ngOnInit(): void {
    if (this.category) {
      this.form = {
        name: this.category.name,
        icon: this.category.icon,
        color: this.category.color,
        isActive: !this.category.isDeleted
      };
    }
  }

  get canSave(): boolean {
    return this.form.name.trim().length > 0 && this.form.icon.trim().length > 0 && this.form.color.trim().length > 0;
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
        color: this.form.color.trim()
      },
      'save'
    );
  }
}
