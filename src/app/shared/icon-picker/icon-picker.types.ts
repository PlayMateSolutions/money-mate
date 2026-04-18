export interface IconPickerIcon {
  name: string;
  tags: string[];
}

export interface IconPickerDataSource {
  icons: IconPickerIcon[];
}

export interface IconPickerConfig {
  sourceUrl: string;
  initialVisibleCount: number;
  loadMoreStep: number;
  title: string;
  searchPlaceholder: string;
  emptyStateText: string;
  loadMoreText: string;
  cancelText: string;
  selectText: string;
}

export interface IconPickerResult {
  icon: string;
}

export const DEFAULT_ICON_PICKER_CONFIG: IconPickerConfig = {
  sourceUrl: 'assets/assets/ionic-icons.json',
  initialVisibleCount: 100,
  loadMoreStep: 100,
  title: 'Select Icon',
  searchPlaceholder: 'Search icons',
  emptyStateText: 'No icons match your search.',
  loadMoreText: 'Load More',
  cancelText: 'Cancel',
  selectText: 'Select'
};