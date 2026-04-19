import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, DoCheck } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import {
  WidgetSettingsOption,
  WidgetSettingsResult,
  WidgetSettingsTopNConfig,
} from './widget-settings.types';

@Component({
  selector: 'app-widget-settings-modal',
  standalone: true,
  templateUrl: './widget-settings-modal.component.html',
  styleUrls: ['./widget-settings-modal.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonText,
    IonTitle,
    IonToolbar,
  ],
})
export class WidgetSettingsModalComponent implements OnInit {
  private prevSelectedIds: Set<string> | null = null;
  @Input() title = 'Widget settings';
  @Input() selectionTitle = 'Visible items';
  @Input() selectionDescription = 'Select which items appear in this widget.';
  @Input() options: WidgetSettingsOption[] = [];
  @Input() selectedIds: string[] | null = null;
  @Input() topN: WidgetSettingsTopNConfig | null = null;

  topNValue = '';
  groupOthersValue = true;
  private selectedIdsDraft = new Set<string>();

  constructor(private readonly modalController: ModalController) {}

  ngOnInit(): void {
    this.selectedIdsDraft = new Set<string>(
      this.selectedIds ?? this.selectableOptionIds
    );
    this.prevSelectedIds = new Set<string>(this.selectedIdsDraft);
    if (typeof this.topN?.value === 'number' && this.topN.value !== null) {
      this.topNValue = String(this.topN.value);
    } else {
      this.topNValue = '';
    }
    this.groupOthersValue = this.topN?.groupOthers ?? true;
    this.updateSelectionForTopN();
  }

  ngDoCheck(): void {
    this.updateSelectionForTopN();
  }

  private updateSelectionForTopN(): void {
    const hasTopN = !!this.topNValue && !isNaN(Number(this.topNValue));
    if (hasTopN) {
      // Save previous selection only once
      if (this.prevSelectedIds === null) {
        this.prevSelectedIds = new Set<string>(this.selectedIdsDraft);
      }
      // Select all and disable list
      if (!this.isAllSelected) {
        this.selectedIdsDraft = new Set<string>(this.selectableOptionIds);
      }
    } else {
      // Restore previous selection if available
      if (this.prevSelectedIds) {
        this.selectedIdsDraft = new Set<string>(this.prevSelectedIds);
        this.prevSelectedIds = null;
      }
    }
  }

  get selectedCount(): number {
    return this.selectedIdsDraft.size;
  }

  get selectableOptionIds(): string[] {
    return this.options
      .filter((option) => !option.disabled)
      .map((option) => option.id);
  }

  get isAllSelected(): boolean {
    return this.selectableOptionIds.every((id) => this.selectedIdsDraft.has(id));
  }

  isSelected(optionId: string): boolean {
    return this.selectedIdsDraft.has(optionId);
  }

  get disableCategoryList(): boolean {
    return !!this.topNValue && !isNaN(Number(this.topNValue));
  }

  setOptionSelected(optionId: string, checked: boolean): void {
    if (checked) {
      this.selectedIdsDraft.add(optionId);
      return;
    }

    this.selectedIdsDraft.delete(optionId);
  }

  selectAllOptions(): void {
    this.selectedIdsDraft = new Set<string>(this.selectableOptionIds);
  }

  clearAllOptions(): void {
    this.selectedIdsDraft = new Set<string>();
  }

  clearTopN(): void {
    this.topNValue = '';
  }

  onTopNChange(value: string | number | null | undefined): void {
    const trimmedValue = String(value ?? '').trim();

    if (!trimmedValue) {
      this.topNValue = '';
      return;
    }

    const parsedValue = Number.parseInt(trimmedValue, 10);

    if (Number.isNaN(parsedValue)) {
      return;
    }

    this.topNValue = String(this.normalizeTopN(parsedValue));
  }

  async cancel(): Promise<void> {
    await this.modalController.dismiss(undefined, 'cancel');
  }

  async apply(): Promise<void> {
    const topNValue = this.topN ? this.getTopNValue() : null;
    const result: WidgetSettingsResult = {
      selectedIds: this.isAllSelected
        ? null
        : this.options
            .map((option) => option.id)
            .filter((id) => this.selectedIdsDraft.has(id)),
      topN: topNValue,
      groupOthers: this.topN ? this.groupOthersValue : undefined,
    };
    console.log('Applying widget settings with result:', JSON.stringify(result));

    await this.modalController.dismiss(result, 'apply');
  }

  private getTopNValue(): number | null {
    const trimmedValue = this.topNValue.trim();

    if (!trimmedValue) {
      return null;
    }

    const parsedValue = Number.parseInt(trimmedValue, 10);
    if (Number.isNaN(parsedValue)) {
      return null;
    }

    return this.normalizeTopN(parsedValue);
  }

  private normalizeTopN(value: number): number {
    const min = this.topN?.min ?? 1;
    const max = this.topN?.max ?? Number.MAX_SAFE_INTEGER;
    return Math.min(Math.max(value, min), max);
  }
}
