import { DASHBOARD_WIDGET_DEFINITIONS, DashboardWidgetId } from './dashboard-widget-registry';

export interface DashboardWidgetLayout {
  id: DashboardWidgetId;
  visible: boolean;
  order: number;
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardWidgetLayout[] = DASHBOARD_WIDGET_DEFINITIONS.map(
  (widget, index) => ({
    id: widget.id,
    visible: true,
    order: index + 1
  })
);
