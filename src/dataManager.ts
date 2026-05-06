import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Fuse from 'fuse.js';
import { SapDataFile, TableInfo, LookupResult, SearchItem } from './types';

const USER_DATA_KEY = 'sapDictionary.userData';

export class DataManager {
  private mergedTables: Record<string, TableInfo> = {};
  private fuseIndex: Fuse<SearchItem> | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext
  ) {}

  async initialize(): Promise<void> {
    const bundled = this.loadBundledData();
    const userData = await this.loadUserData();
    this.mergedTables = this.merge(bundled, userData);
    this.buildSearchIndex();
  }

  private loadBundledData(): Record<string, TableInfo> {
    const bundlePath = path.join(this.context.extensionPath, 'data', 'sap-standard.json');
    if (!fs.existsSync(bundlePath)) {
      return {};
    }
    const raw = fs.readFileSync(bundlePath, 'utf-8');
    const parsed: SapDataFile = JSON.parse(raw);
    return parsed.tables ?? {};
  }

  private async loadUserData(): Promise<Record<string, TableInfo>> {
    const raw = this.context.globalState.get<string>(USER_DATA_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed: SapDataFile = JSON.parse(raw);
      return parsed.tables ?? {};
    } catch {
      return {};
    }
  }

  /** User data wins: user fields overlay bundled fields for the same table. */
  private merge(
    bundled: Record<string, TableInfo>,
    userData: Record<string, TableInfo>
  ): Record<string, TableInfo> {
    const result: Record<string, TableInfo> = { ...bundled };
    for (const [tableName, userTable] of Object.entries(userData)) {
      if (result[tableName]) {
        result[tableName] = {
          description: userTable.description || result[tableName].description,
          category: userTable.category ?? result[tableName].category,
          fields: { ...result[tableName].fields, ...userTable.fields },
        };
      } else {
        result[tableName] = userTable;
      }
    }
    return result;
  }

  private buildSearchIndex(): void {
    const items: SearchItem[] = [];
    for (const [tableName, tableInfo] of Object.entries(this.mergedTables)) {
      items.push({ tableName, tableDescription: tableInfo.description });
      for (const [fieldName, fieldInfo] of Object.entries(tableInfo.fields)) {
        items.push({
          tableName,
          tableDescription: tableInfo.description,
          fieldName,
          fieldDescription: fieldInfo.description,
        });
      }
    }
    this.fuseIndex = new Fuse(items, {
      keys: [
        { name: 'tableName', weight: 2 },
        { name: 'fieldName', weight: 2 },
        { name: 'tableDescription', weight: 1 },
        { name: 'fieldDescription', weight: 1 },
      ],
      threshold: 0.35,
      minMatchCharLength: 2,
    });
  }

  lookup(tableName: string, fieldName?: string): LookupResult | null {
    const tableInfo = this.mergedTables[tableName.toUpperCase()];
    if (!tableInfo) {
      return null;
    }
    if (!fieldName) {
      return { tableName, tableInfo };
    }
    const fieldInfo = tableInfo.fields[fieldName.toUpperCase()];
    if (!fieldInfo) {
      return { tableName, tableInfo };
    }
    return { tableName, tableInfo, fieldName: fieldName.toUpperCase(), fieldInfo };
  }

  search(query: string): SearchItem[] {
    if (!query.trim() || !this.fuseIndex) {
      return [];
    }
    return this.fuseIndex.search(query).map(r => r.item).slice(0, 50);
  }

  getAllTableNames(): string[] {
    return Object.keys(this.mergedTables).sort();
  }

  getTableInfo(tableName: string): TableInfo | undefined {
    return this.mergedTables[tableName.toUpperCase()];
  }

  async importUserData(filePath: string): Promise<{ tableCount: number; fieldCount: number }> {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed: SapDataFile = JSON.parse(raw);
    if (!parsed.tables) {
      throw new Error('Invalid file: missing "tables" key');
    }
    await this.context.globalState.update(USER_DATA_KEY, raw);
    const userData = parsed.tables;
    this.mergedTables = this.merge(this.loadBundledData(), userData);
    this.buildSearchIndex();
    const fieldCount = Object.values(userData).reduce(
      (sum, t) => sum + Object.keys(t.fields).length, 0
    );
    return { tableCount: Object.keys(userData).length, fieldCount };
  }

  async clearUserData(): Promise<void> {
    await this.context.globalState.update(USER_DATA_KEY, undefined);
    this.mergedTables = this.merge(this.loadBundledData(), {});
    this.buildSearchIndex();
  }

  hasUserData(): boolean {
    return !!this.context.globalState.get<string>(USER_DATA_KEY);
  }
}
