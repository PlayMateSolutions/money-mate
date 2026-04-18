import { Injectable } from '@angular/core';
import {
  DashboardWidgetLayout,
  DEFAULT_DASHBOARD_LAYOUT
} from './dashboard-layout';
import { DASHBOARD_WIDGET_DEFINITIONS, DashboardWidgetId } from './dashboard-widget-registry';

@Injectable({
  providedIn: 'root'
})
export class DashboardLayoutService {
  private readonly storageKey = 'dashboard.layout';

  getLayout(): DashboardWidgetLayout[] {
    const rawValue = localStorage.getItem(this.storageKey);
    if (!rawValue) {
      return this.getDefaultLayout();
    }

    try {
      const parsed = JSON.parse(rawValue) as DashboardWidgetLayout[];
      return this.sanitizeLayout(parsed);
    } catch (error) {
      console.error('Failed to parse dashboard layout from localStorage', error);
      return this.getDefaultLayout();
    }
  }

  saveLayout(layout: DashboardWidgetLayout[]): DashboardWidgetLayout[] {
    const sanitizedLayout = this.sanitizeLayout(layout);
    localStorage.setItem(this.storageKey, JSON.stringify(sanitizedLayout));
    return sanitizedLayout;
  }

  getDefaultLayout(): DashboardWidgetLayout[] {
    return DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));
  }

  private sanitizeLayout(layout: DashboardWidgetLayout[]): DashboardWidgetLayout[] {
    const validIds = new Set<DashboardWidgetId>(
      DASHBOARD_WIDGET_DEFINITIONS.map((widget) => widget.id)
    );

    const filtered = layout
      .filter((item) => validIds.has(item.id))
      .reduce<DashboardWidgetLayout[]>((acc, item) => {
        if (acc.some((existing) => existing.id === item.id)) {
          return acc;
        }

        acc.push({
          id: item.id,
          visible: !!item.visible,
          order: Number.isFinite(item.order) ? item.order : acc.length + 1
        });

        return acc;
      }, []);

    const missingItems = DASHBOARD_WIDGET_DEFINITIONS
      .filter((widget) => !filtered.some((item) => item.id === widget.id))
      .map((widget) => ({
        id: widget.id,
        visible: widget.defaultVisible ?? true,
        order: Number.MAX_SAFE_INTEGER
      }));

    return [...filtered, ...missingItems]
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({
        ...item,
        order: index + 1
      }));
  }
}
