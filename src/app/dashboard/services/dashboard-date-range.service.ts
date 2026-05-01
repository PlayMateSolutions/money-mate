import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type DashboardDateRange = {
  startDate: Date;
  endDate: Date;
  period: 'weekly' | 'monthly' | 'yearly' | 'custom';
};

@Injectable({ providedIn: 'root' })
export class DashboardDateRangeService {
  private readonly dateRangeSubject = new BehaviorSubject<DashboardDateRange>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
    period: 'monthly',
  });

  getDateRange$(): Observable<DashboardDateRange> {
    return this.dateRangeSubject.asObservable();
  }

  setDateRange(range: DashboardDateRange): void {
    this.dateRangeSubject.next(range);
  }

  getCurrentDateRange(): DashboardDateRange {
    return this.dateRangeSubject.value;
  }
}
