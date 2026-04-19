import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
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
  @Input() title = 'Widget settings';
  @Input() selectionTitle = 'Visible items';
  @Input() selectionDescription = 'Select which items appear in this widget.';
  @Input() options: WidgetSettingsOption[] = [];
  @Input() selectedIds: string[] | null = null;
  @Input() topN: WidgetSettingsTopNConfig | null = null;

  topNValue = '';
  private selectedIdsDraft = new Set<string>();

  constructor(private readonly modalController: ModalController) {}

  ngOnInit(): void {
    this.selectedIdsDraft = new Set<string>(
      this.selectedIds ?? this.selectableOptionIds
    );
    this.topNValue = this.topN?.value == null ? '' : String(this.topN.value);
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
    const result: WidgetSettingsResult = {
      selectedIds: this.isAllSelected
        ? null
        : this.options
            .map((option) => option.id)
            .filter((id) => this.selectedIdsDraft.has(id)),
      topN: this.topN ? this.getTopNValue() : undefined,
    };

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
