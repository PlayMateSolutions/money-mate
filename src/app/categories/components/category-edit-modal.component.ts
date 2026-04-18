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
  templateUrl: 'category-edit-modal.component.html',
  styleUrls: ['category-edit-modal.component.scss'],
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
