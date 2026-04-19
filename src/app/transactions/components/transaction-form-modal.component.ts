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
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonDatetime,
  IonDatetimeButton,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonChip,
  IonIcon,
  IonNote,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronUpOutline, closeCircle } from 'ionicons/icons';
import { Account, Category, Transaction, TransactionType } from '../../core/database/models';
import { AccountRepository, CategoryRepository, TransactionRepository, CreateTransactionInput, UpdateTransactionInput } from '../../core/database/repositories';

@Component({
  selector: 'app-transaction-form-modal',
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
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonSegment,
    IonSegmentButton,
    IonChip,
    IonIcon,
    IonNote
  ],
  templateUrl: './transaction-form-modal.component.html',
  styles: [`
    ion-segment {
      margin-bottom: 4px;
    }
  `]
})

