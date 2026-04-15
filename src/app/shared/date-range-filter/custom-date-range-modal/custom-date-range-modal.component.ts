import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonInput,
  IonItem,
  IonItemDivider,
  IonList,
  IonListHeader,
  IonLabel,
  IonRadio,
  IonRadioGroup,
  ModalController
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-custom-date-range-modal',
  templateUrl: './custom-date-range-modal.component.html',
  styleUrls: ['./custom-date-range-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonButton,
    IonInput,
    IonItem,
    IonItemDivider,
    IonList,
    IonListHeader,
    IonLabel,
    IonRadio,
    IonRadioGroup
  ]
})
export class CustomDateRangeModalComponent implements OnInit {
  @Input() startDate: Date = new Date();
  @Input() endDate: Date = new Date();

  selectedStartDate: string = '';
  selectedEndDate: string = '';
  selectedOption: 'last7days' | 'thisweek' | 'last30days' | 'thismonth' | 'thisyear' | 'last12months' | 'all' | 'custom' | null = null;

  constructor(private modalController: ModalController) {}

  ngOnInit() {
    this.initializeDates();
  }

  private initializeDates() {
    this.selectedStartDate = this.dateToIsoString(this.startDate);
    this.selectedEndDate = this.dateToIsoString(this.endDate);
  }

  private dateToIsoString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  selectPreset(preset: 'last7days' | 'thisweek' | 'last30days' | 'thismonth' | 'thisyear' | 'last12months' | 'all') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let startDate: Date;
    let endDate: Date = new Date(today);

    switch (preset) {
      case 'last7days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'thisweek':
        startDate = new Date(today);
        const dayOfWeek = startDate.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(startDate.getDate() - daysToMonday);
        break;
      case 'last30days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'thismonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'thisyear':
        startDate = new Date(today.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'last12months':
        startDate = new Date(today);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date(2020, 0, 1);
        break;
      default:
        return;
    }

    this.selectedStartDate = this.dateToIsoString(startDate);
    this.selectedEndDate = this.dateToIsoString(endDate);
    this.selectedOption = preset;
  }

  onPresetChange(event: any) {
    const preset = event.detail.value;
    this.selectPreset(preset);
  }

  onCancel() {
    this.modalController.dismiss(null, 'cancel');
  }

  onConfirm() {
    if (!this.selectedStartDate || !this.selectedEndDate) {
      return;
    }

    // Parse date string manually to avoid timezone issues
    const [startYear, startMonth, startDay] = this.selectedStartDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = this.selectedEndDate.split('-').map(Number);

    let startDate = new Date(startYear, startMonth - 1, startDay);
    let endDate = new Date(endYear, endMonth - 1, endDay);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // Ensure start date is before end date
    if (startDate > endDate) {
      const temp = startDate;
      startDate = endDate;
      endDate = temp;
    }

    this.modalController.dismiss({ startDate, endDate }, 'confirm');
  }

  isConfirmDisabled(): boolean {
    if (!this.selectedStartDate || !this.selectedEndDate) {
      return true;
    }

    // Parse date string manually to avoid timezone issues
    const [startYear, startMonth, startDay] = this.selectedStartDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = this.selectedEndDate.split('-').map(Number);

    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Disable if dates are after today
    return startDate > today || endDate > today;
  }
}
