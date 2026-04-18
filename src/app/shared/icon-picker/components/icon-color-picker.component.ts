import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonIcon, IonInput } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { refreshOutline } from 'ionicons/icons';

@Component({
  selector: 'app-icon-color-picker',
  standalone: true,
  templateUrl: './icon-color-picker.component.html',
  styleUrls: ['./icon-color-picker.component.scss'],
  imports: [CommonModule, FormsModule, IonButton, IonIcon, IonInput]
})
export class IconColorPickerComponent implements OnChanges {
  @Input() value = '#2196F3';
  @Input() swatchCount = 7;
  @Input() allowManualInput = true;

  @Output() valueChange = new EventEmitter<string>();

  colors: string[] = [];
  inputValue = '#2196F3';
  private selectedColor = '#2196F3';

  constructor() {
    addIcons({ 'refresh-outline': refreshOutline });
    this.rebuildPalette(this.selectedColor);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['swatchCount'] && !changes['swatchCount'].firstChange) {
      this.rebuildPalette(this.selectedColor);
      return;
    }

    if (!changes['value']) {
      return;
    }

    const nextColor = this.normalizeColor(this.value) ?? this.selectedColor;
    if (!this.colors.length) {
      this.rebuildPalette(nextColor);
      return;
    }

    this.setSelectedColor(nextColor);
  }

  isSelected(color: string): boolean {
    return color === this.selectedColor;
  }

  selectColor(color: string): void {
    this.setSelectedColor(color);
    this.valueChange.emit(this.selectedColor);
  }

  refreshPalette(): void {
    this.rebuildPalette(this.selectedColor);
  }

  onInputChange(value: string | number | null | undefined): void {
    this.inputValue = String(value ?? '').trim().toUpperCase();
    const nextColor = this.normalizeColor(this.inputValue);
    if (!nextColor) {
      return;
    }

    this.selectColor(nextColor);
  }

  private rebuildPalette(primaryColor: string): void {
    this.selectedColor = primaryColor;
    this.inputValue = primaryColor;

    const generated = new Set<string>([primaryColor]);
    while (generated.size < this.swatchCount) {
      generated.add(this.generateRandomColor());
    }

    this.colors = [primaryColor, ...Array.from(generated).filter((color) => color !== primaryColor)];
  }

  private setSelectedColor(color: string): void {
    this.selectedColor = color;
    this.inputValue = color;
  }

  private generateRandomColor(): string {
    return (`#${((Math.random() * 0xFFFFFF) << 0).toString(16).padStart(6, '0')}`).toUpperCase();
  }

  private normalizeColor(value: string): string | null {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    if (/^#([0-9A-F]{3}|[0-9A-F]{6})$/.test(normalized)) {
      return normalized;
    }

    return null;
  }
}
