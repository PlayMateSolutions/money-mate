import { Component, EventEmitter, Input, Output, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonTitle,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { CustomDateRangeModalComponent } from './custom-date-range-modal/custom-date-range-modal.component';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  period: 'weekly' | 'monthly' | 'yearly' | 'custom';
}

@Component({
  selector: 'app-date-range-filter',
  templateUrl: './date-range-filter.component.html',
  styleUrls: ['./date-range-filter.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonTitle
  ]
})
export class DateRangeFilterComponent implements AfterViewInit {
  @Input() selectedPeriod: 'weekly' | 'monthly' | 'yearly' | 'custom' = 'monthly';
  @Input() showNavigation: boolean = true;
  @Input() availablePeriods: ('weekly' | 'monthly' | 'yearly' | 'custom')[] = ['weekly', 'monthly', 'yearly', 'custom'];
  @Output() dateRangeChange = new EventEmitter<DateRange>();

  // If false, hides the period picker segment and only shows navigation.
  @Input() showPeriodPicker: boolean = true;

  currentWeekStart = new Date();
  currentMonth = new Date();
  currentYear = new Date();
  customStartDate: Date | null = null;
  customEndDate: Date | null = null;
  private isOpeningCustomModal = false;

  constructor(private modalController: ModalController) {
    addIcons({ chevronBackOutline, chevronForwardOutline });
    this.setCurrentWeekStart();
  }

  onPeriodChange(event: any) {
    const period = event.detail.value;
    if (period === 'custom') {
      // Set flag to prevent click handler from opening modal again
      this.isOpeningCustomModal = true;
      this.openCustomDateModal();
    } else {
      this.selectedPeriod = period;
      this.emitDateRange();
    }
  }

  onCustomSegmentClick() {
    // Only open modal if it's not already being opened by ionChange event
    if (!this.isOpeningCustomModal) {
      this.openCustomDateModal();
    } else {
      // Reset flag for next click
      this.isOpeningCustomModal = false;
    }
  }

  async openCustomDateModal() {
    const modal = await this.modalController.create({
      component: CustomDateRangeModalComponent,
      componentProps: {
        startDate: this.customStartDate || this.currentMonth, // Default to current month start
        endDate: this.customEndDate || new Date()
      }
    });

    await modal.present();

    const result = await modal.onDidDismiss();
    
    // Reset flag after modal closes
    this.isOpeningCustomModal = false;
    
    if (result.role === 'confirm' && result.data) {
      const { startDate, endDate } = result.data;
      this.customStartDate = startDate;
      this.customEndDate = endDate;
      this.selectedPeriod = 'custom';
      this.emitDateRange();
    }
  }

  isPeriodAvailable(period: 'weekly' | 'monthly' | 'yearly' | 'custom'): boolean {
    return this.availablePeriods.includes(period);
  }

  private setCurrentWeekStart() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    this.currentWeekStart = new Date(today);
    this.currentWeekStart.setDate(today.getDate() - daysToMonday);
    this.currentWeekStart.setHours(0, 0, 0, 0);
  }

  goToPreviousPeriod() {
    switch(this.selectedPeriod) {
      case 'weekly':
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
        break;
      case 'monthly':
        this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
        break;
      case 'yearly':
        this.currentYear.setFullYear(this.currentYear.getFullYear() - 1);
        break;
      case 'custom':
        if (this.customStartDate && this.customEndDate) {
          const rangeDays = this.getCustomRangeDays();
          this.customStartDate.setDate(this.customStartDate.getDate() - rangeDays);
          this.customEndDate.setDate(this.customEndDate.getDate() - rangeDays);
        }
        break;
    }
    this.emitDateRange();
  }

  goToNextPeriod() {
    switch(this.selectedPeriod) {
      case 'weekly':
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
        break;
      case 'monthly':
        this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
        break;
      case 'yearly':
        this.currentYear.setFullYear(this.currentYear.getFullYear() + 1);
        break;
      case 'custom':
        if (this.customStartDate && this.customEndDate) {
          const rangeDays = this.getCustomRangeDays();
          this.customStartDate.setDate(this.customStartDate.getDate() + rangeDays);
          this.customEndDate.setDate(this.customEndDate.getDate() + rangeDays);
        }
        break;
    }
    this.emitDateRange();
  }

  canGoToNextPeriod(): boolean {
    const now = new Date();
    switch(this.selectedPeriod) {
      case 'weekly':
        const nextWeek = new Date(this.currentWeekStart);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek < now;
      case 'monthly':
        const nextMonth = new Date(this.currentMonth);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth < now;
      case 'yearly':
        const nextYear = new Date(this.currentYear);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear < now;
      case 'custom':
        if (this.customStartDate && this.customEndDate) {
          const nextEndDate = new Date(this.customEndDate);
          const rangeDays = this.getCustomRangeDays();
          nextEndDate.setDate(nextEndDate.getDate() + rangeDays);
          nextEndDate.setHours(0, 0, 0, 0);
          now.setHours(0, 0, 0, 0);
          return nextEndDate <= now;
        }
        return false;
      default:
        return false;
    }
  }

  private getCustomRangeDays(): number {
    if (!this.customStartDate || !this.customEndDate) {
      return 0;
    }
    const timeDiff = this.customEndDate.getTime() - this.customStartDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff + 1; // Include both start and end date
  }

  getCurrentPeriodText(): string {
    switch(this.selectedPeriod) {
      case 'weekly':
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${this.formatShortDate(this.currentWeekStart)} - ${this.formatShortDate(weekEnd)}`;
      case 'monthly':
        return this.currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'yearly':
        return this.currentYear.getFullYear().toString();
      case 'custom':
        if (this.customStartDate && this.customEndDate) {
          const startYear = this.customStartDate.getFullYear();
          const endYear = this.customEndDate.getFullYear();
          
          if (startYear !== endYear) {
            // Different years: show year for both dates
            return `${this.formatShortDateWithYear(this.customStartDate)} - ${this.formatShortDateWithYear(this.customEndDate)}`;
          } else {
            // Same year: show year only for end date
            return `${this.formatShortDate(this.customStartDate)} - ${this.formatShortDateWithYear(this.customEndDate)}`;
          }
        }
        return '';
      default:
        return '';
    }
  }

  private formatShortDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private formatShortDateWithYear(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private emitDateRange() {
    const range = this.getDateRange();
    this.dateRangeChange.emit(range);
  }

  private getDateRange(): DateRange {
    let startDate: Date;
    let endDate: Date;

    switch(this.selectedPeriod) {
      case 'weekly':
        startDate = new Date(this.currentWeekStart);
        endDate = new Date(this.currentWeekStart);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'monthly':
        startDate = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        endDate = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'yearly':
        startDate = new Date(this.currentYear.getFullYear(), 0, 1);
        endDate = new Date(this.currentYear.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'custom':
        startDate = this.customStartDate || new Date();
        endDate = this.customEndDate || new Date();
        endDate.setHours(23, 59, 59, 999);
        break;
      
      default:
        startDate = new Date();
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    return { startDate, endDate, period: this.selectedPeriod };
  }

  // Call this after component init to emit initial range
  ngAfterViewInit() {
    setTimeout(() => this.emitDateRange(), 0);
  }
}
