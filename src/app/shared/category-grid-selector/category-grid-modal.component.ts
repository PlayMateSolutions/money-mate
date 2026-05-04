import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  ModalController,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmark, close, trash } from 'ionicons/icons';
import { Category } from '../../core/database/models';
import { CategoryGridSelectorComponent } from './category-grid-selector.component';

@Component({
  selector: 'app-category-grid-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonFooter,
    IonIcon,
    CategoryGridSelectorComponent,
  ],
  templateUrl: './category-grid-modal.component.html',
  styleUrls: ['./category-grid-modal.component.scss'],
})
export class CategoryGridModalComponent {
  @Input() title = 'Categories';
  @Input() categories: Category[] = [];
  @Input() selectedCategoryIds: string[] = [];
  @Input() includeUncategorized = true;

  localSelectedCategoryIds: string[] = [];

  constructor(private readonly modalController: ModalController) {
    addIcons({ close, checkmark, trash });
  }

  ngOnInit(): void {
    this.localSelectedCategoryIds = [...this.selectedCategoryIds];
  }

  clearAll(): void {
    this.localSelectedCategoryIds = [];
  }

  async cancel(): Promise<void> {
    await this.modalController.dismiss(undefined, 'cancel');
  }

  async apply(): Promise<void> {
    await this.modalController.dismiss([...this.localSelectedCategoryIds], 'apply');
  }
}
