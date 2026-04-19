export interface WidgetSettingsOption {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface WidgetSettingsTopNConfig {
  value: number | null;
  label?: string;
  helperText?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  /** Whether remaining items beyond topN are grouped as "Other". Defaults to true. */
  groupOthers?: boolean;
}

export interface WidgetSettingsResult {
  selectedIds: string[] | null;
  topN?: number | null;
  groupOthers?: boolean;
}
