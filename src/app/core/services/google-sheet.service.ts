import { Injectable } from '@angular/core';
import { GoogleSheetsDbService } from './google-sheets-db.service';
import { Category, GUEST_USER_NAME } from '../database/models';
import { CategoryRepository } from '../database/repositories';

export interface SpreadsheetSummary {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class GoogleSheetService {
  constructor(
    private readonly googleSheetsDbService: GoogleSheetsDbService,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async listUserSpreadsheets(): Promise<SpreadsheetSummary[]> {
    return this.googleSheetsDbService.listSpreadsheets();
  }

  async createMoneyMateSpreadsheet(title: string): Promise<SpreadsheetSummary> {
    const result = await this.googleSheetsDbService.createSpreadsheet(title, [
      'accounts',
      'categories',
      'transactions',
    ]);

    await this.googleSheetsDbService.batchUpdateValues([
      {
        range: 'accounts!A1',
        values: [[
          'id',
          'name',
          'type',
          'balance',
          'ownerName',
          'color',
          'icon',
          'notes',
          'isDeleted',
          'createdAt',
          'updatedAt',
        ]],
      },
      {
        range: 'categories!A1',
        values: [[
          'id',
          'name',
          'type',
          'color',
          'icon',
          'sortOrder',
          'isDeleted',
          'createdAt',
          'updatedAt',
          'createdBy',
          'updatedBy',
        ]],
      },
      {
        range: 'transactions!A1',
        values: [[
          'id',
          'accountId',
          'amount',
          'type',
          'categoryId',
          'description',
          'date',
          'notes',
          'tags',
          'transferToAccountId',
          'isDeleted',
          'createdAt',
          'updatedAt',
          'createdBy',
          'updatedBy',
        ]],
      },
    ]);

    return {
      id: result.spreadsheetId,
      name: result.title,
    };
  }

  async syncCategories(): Promise<void> {
    const sheetRows = await this.googleSheetsDbService.getValues('categories!A:K');
    const rowsWithoutHeader = sheetRows.slice(1);
    const localCategories = await this.categoryRepository.getCategoriesForSettings();

    const sheetById = new Map<string, { category: Category; rowNumber: number }>();
    rowsWithoutHeader.forEach((row, index) => {
      const parsed = this.parseSheetCategory(row);
      if (!parsed) {
        return;
      }

      sheetById.set(parsed.id, {
        category: parsed,
        rowNumber: index + 2,
      });
    });

    const localById = new Map(localCategories.map((category) => [category.id, category]));

    for (const [id, sheetRecord] of sheetById.entries()) {
      const localRecord = localById.get(id);
      if (!localRecord) {
        await this.categoryRepository.upsertFromSheet(sheetRecord.category);
        continue;
      }

      const localUpdatedAt = new Date(localRecord.updatedAt).getTime();
      const sheetUpdatedAt = new Date(sheetRecord.category.updatedAt).getTime();
      const isSheetNewer = sheetUpdatedAt > localUpdatedAt;

      if (isSheetNewer && !localRecord.isDirty) {
        await this.categoryRepository.upsertFromSheet(sheetRecord.category);
      }
    }

    const dirtyCategories = await this.categoryRepository.getDirtyCategories();
    const pushedIds: string[] = [];

    for (const category of dirtyCategories) {
      const rowValues = [this.toSheetCategoryRow(category)];
      const existing = sheetById.get(category.id);

      if (existing) {
        await this.googleSheetsDbService.updateRangeValues(
          `categories!A${existing.rowNumber}:K${existing.rowNumber}`,
          rowValues,
        );
      } else {
        await this.googleSheetsDbService.appendValues(
          'categories!A:K',
          rowValues,
        );
      }

      pushedIds.push(category.id);
    }

    await this.categoryRepository.clearDirtyFlags(pushedIds);
  }

  private parseSheetCategory(row: string[]): Category | null {
    if (!row[0]) {
      return null;
    }

    const createdAt = this.parseDate(row[7]);
    const updatedAt = this.parseDate(row[8]);

    return {
      id: row[0],
      name: row[1] || '',
      type: row[2] === 'income' || row[2] === 'expense' ? row[2] : undefined,
      color: row[3] || '#9E9E9E',
      icon: row[4] || 'pricetag-outline',
      sortOrder: Number(row[5] || 0),
      isDeleted: row[6] === 'true',
      createdAt,
      updatedAt,
      createdBy: row[9] || GUEST_USER_NAME,
      updatedBy: row[10] || row[9] || GUEST_USER_NAME,
      isDirty: false,
    };
  }

  private toSheetCategoryRow(category: Category): string[] {
    return [
      category.id,
      category.name,
      category.type || '',
      category.color,
      category.icon,
      String(category.sortOrder),
      String(!!category.isDeleted),
      this.toIso(category.createdAt),
      this.toIso(category.updatedAt),
      category.createdBy || GUEST_USER_NAME,
      category.updatedBy || category.createdBy || GUEST_USER_NAME,
    ];
  }

  private toIso(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  private parseDate(value: string | undefined): Date {
    if (!value) {
      return new Date();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
