import { Injectable } from '@angular/core';

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
  async listSpreadsheets(accessToken: string, pageSize = 25): Promise<GoogleDriveSpreadsheetFile[]> {
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

  async createSpreadsheet(accessToken: string, title: string, sheetTitles: string[]): Promise<GoogleSpreadsheetCreateResult> {
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
    accessToken: string,
    spreadsheetId: string,
    ranges: GoogleBatchUpdateRange[],
  ): Promise<void> {
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

  async getValues(accessToken: string, spreadsheetId: string, range: string): Promise<string[][]> {
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
    accessToken: string,
    spreadsheetId: string,
    range: string,
    values: string[][],
  ): Promise<void> {
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
    accessToken: string,
    spreadsheetId: string,
    range: string,
    values: string[][],
  ): Promise<void> {
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
}
