import { Injectable } from '@angular/core';
import { SessionService } from './session.service';

export interface GoogleDriveSpreadsheetFile {
  id: string;
  name: string;
}

export interface GoogleSpreadsheetCreateResult {
  spreadsheetId: string;
  title: string;
}

export interface GoogleBatchUpdateRange {
  range: string;
  values: string[][];
}

@Injectable({
  providedIn: 'root',
})
export class GoogleSheetsDbService {
  constructor(private readonly sessionService: SessionService) {}

  async listSpreadsheets(pageSize = 25): Promise<GoogleDriveSpreadsheetFile[]> {
    const accessToken = this.getAccessToken();
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const fields = encodeURIComponent('files(id,name,modifiedTime)');

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=${pageSize}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch spreadsheets (${response.status})`);
    }

    const data = await response.json() as { files?: Array<{ id: string; name: string }> };
    return (data.files || [])
      .filter((file) => !!file.id)
      .map((file) => ({
        id: file.id,
        name: file.name || 'Untitled Spreadsheet',
      }));
  }

  async createSpreadsheet(title: string, sheetTitles: string[]): Promise<GoogleSpreadsheetCreateResult> {
    const accessToken = this.getAccessToken();
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: sheetTitles.map((sheetTitle) => ({ properties: { title: sheetTitle } })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create sheet (${response.status})`);
    }

    const data = await response.json() as { spreadsheetId: string; properties?: { title?: string } };
    return {
      spreadsheetId: data.spreadsheetId,
      title: data.properties?.title || title,
    };
  }

  async batchUpdateValues(
    ranges: GoogleBatchUpdateRange[],
  ): Promise<void> {
    const accessToken = this.getAccessToken();
    const spreadsheetId = this.getSpreadsheetId();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: ranges,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to populate headers (${response.status})`);
    }
  }

  async getValues(range: string): Promise<string[][]> {
    const accessToken = this.getAccessToken();
    const spreadsheetId = this.getSpreadsheetId();
    const encodedRange = encodeURIComponent(range);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet values (${response.status})`);
    }

    const data = await response.json() as { values?: string[][] };
    return data.values || [];
  }

  async appendValues(
    range: string,
    values: string[][],
  ): Promise<void> {
    const accessToken = this.getAccessToken();
    const spreadsheetId = this.getSpreadsheetId();
    const encodedRange = encodeURIComponent(range);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to append values (${response.status})`);
    }
  }

  async updateRangeValues(
    range: string,
    values: string[][],
  ): Promise<void> {
    const accessToken = this.getAccessToken();
    const spreadsheetId = this.getSpreadsheetId();
    const encodedRange = encodeURIComponent(range);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to update range values (${response.status})`);
    }
  }

  private getAccessToken(): string {
    const accessToken = this.sessionService.currentSession?.accessToken;
    if (!accessToken) {
      throw new Error('Google access token is not available');
    }

    return accessToken;
  }

  private getSpreadsheetId(): string {
    const spreadsheetId = this.sessionService.linkedSpreadsheet?.id;
    if (!spreadsheetId) {
      throw new Error('Linked spreadsheet is not available');
    }

    return spreadsheetId;
  }
}
