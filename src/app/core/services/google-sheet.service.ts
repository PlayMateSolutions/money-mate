import { Injectable } from '@angular/core';
import { GoogleSheetsDbService } from './google-sheets-db.service';

export interface SpreadsheetSummary {
  id: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class GoogleSheetService {
  constructor(private readonly googleSheetsDbService: GoogleSheetsDbService) {}

  async listUserSpreadsheets(accessToken: string): Promise<SpreadsheetSummary[]> {
    return this.googleSheetsDbService.listSpreadsheets(accessToken);
  }

  async createMoneyMateSpreadsheet(accessToken: string, title: string): Promise<SpreadsheetSummary> {
    const result = await this.googleSheetsDbService.createSpreadsheet(accessToken, title, [
      'accounts',
      'categories',
      'transactions',
    ]);

    await this.googleSheetsDbService.batchUpdateValues(accessToken, result.spreadsheetId, [
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
}
