import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import Fuse from 'fuse.js';
import { SapDataFile, TableInfo, LookupResult, SearchItem, ImportEntry, ImportEntryMeta } from './types';

const IMPORTS_KEY = 'sapDictionary.importEntries';
const LEGACY_KEY = 'sapDictionary.userData';

export class DataManager {
  private mergedTables: Record<string, TableInfo> = {};
  private importEntries: ImportEntry[] = [];
  private fuseIndex: Fuse<SearchItem> | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async initialize(): Promise<void> {
    await this.migrateLegacy();
    const bundled = this.loadBundledData();
    this.importEntries = await this.loadImportEntries();
    this.mergedTables = this.mergeAll(bundled, this.importEntries);
    this.buildSearchIndex();
  }

  private async migrateLegacy(): Promise<void> {
    const raw = this.context.globalState.get<string>(LEGACY_KEY);
    if (!raw) return;
    try {
      const parsed: SapDataFile = JSON.parse(raw);
      const tables = parsed.tables ?? {};
      const fieldCount = Object.values(tables).reduce((s, t) => s + Object.keys(t.fields).length, 0);
      const entry: ImportEntry = {
        id: crypto.randomUUID(),
        filename: 'imported-data.json',
        importedAt: new Date().toISOString(),
        tableCount: Object.keys(tables).length,
        fieldCount,
        tables,
      };
      const existing = await this.loadImportEntries();
      existing.push(entry);
      await this.context.globalState.update(IMPORTS_KEY, JSON.stringify(existing));
    } catch { /* discard corrupt legacy data */ }
    await this.context.globalState.update(LEGACY_KEY, undefined);
  }

  loadBundledData(): Record<string, TableInfo> {
    const bundlePath = path.join(this.context.extensionPath, 'data', 'sap-standard.json');
    if (!fs.existsSync(bundlePath)) return {};
    const raw = fs.readFileSync(bundlePath, 'utf-8');
    const parsed: SapDataFile = JSON.parse(raw);
    return parsed.tables ?? {};
  }

  private async loadImportEntries(): Promise<ImportEntry[]> {
    const raw = this.context.globalState.get<string>(IMPORTS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ImportEntry[];
    } catch {
      return [];
    }
  }

  private mergeAll(bundled: Record<string, TableInfo>, entries: ImportEntry[]): Record<string, TableInfo> {
    let result: Record<string, TableInfo> = { ...bundled };
    for (const entry of entries) {
      result = this.merge(result, entry.tables);
    }
    return result;
  }

  private merge(base: Record<string, TableInfo>, overlay: Record<string, TableInfo>): Record<string, TableInfo> {
    const result: Record<string, TableInfo> = { ...base };
    for (const [tableName, userTable] of Object.entries(overlay)) {
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
        items.push({ tableName, tableDescription: tableInfo.description, fieldName, fieldDescription: fieldInfo.description });
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
    const upperTable = tableName.toUpperCase();
    const tableInfo = this.mergedTables[upperTable];
    if (!tableInfo) return null;
    if (!fieldName) return { tableName: upperTable, tableInfo };
    const upperField = fieldName.toUpperCase();
    const fieldInfo = tableInfo.fields[upperField];
    if (!fieldInfo) return { tableName: upperTable, tableInfo };
    return { tableName: upperTable, tableInfo, fieldName: upperField, fieldInfo };
  }

  search(query: string): SearchItem[] {
    if (!query.trim() || !this.fuseIndex) return [];
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
    if (!parsed.tables || typeof parsed.tables !== 'object' || Array.isArray(parsed.tables)) {
      throw new Error('Invalid file: "tables" must be an object');
    }
    for (const [tbl, info] of Object.entries(parsed.tables)) {
      if (!info.fields || typeof info.fields !== 'object') {
        throw new Error(`Invalid file: table "${tbl}" is missing a "fields" object`);
      }
    }
    const tableCount = Object.keys(parsed.tables).length;
    const fieldCount = Object.values(parsed.tables).reduce((s, t) => s + Object.keys(t.fields).length, 0);
    const entry: ImportEntry = {
      id: crypto.randomUUID(),
      filename: path.basename(filePath),
      importedAt: new Date().toISOString(),
      tableCount,
      fieldCount,
      tables: parsed.tables,
    };
    this.importEntries.push(entry);
    await this.context.globalState.update(IMPORTS_KEY, JSON.stringify(this.importEntries));
    this.mergedTables = this.mergeAll(this.loadBundledData(), this.importEntries);
    this.buildSearchIndex();
    return { tableCount, fieldCount };
  }

  async deleteImportEntry(id: string): Promise<void> {
    this.importEntries = this.importEntries.filter(e => e.id !== id);
    await this.context.globalState.update(IMPORTS_KEY, JSON.stringify(this.importEntries));
    this.mergedTables = this.mergeAll(this.loadBundledData(), this.importEntries);
    this.buildSearchIndex();
  }

  async clearUserData(): Promise<void> {
    this.importEntries = [];
    await this.context.globalState.update(IMPORTS_KEY, undefined);
    this.mergedTables = this.mergeAll(this.loadBundledData(), []);
    this.buildSearchIndex();
  }

  hasUserData(): boolean {
    return this.importEntries.length > 0;
  }

  getImportEntries(): ImportEntryMeta[] {
    return this.importEntries.map(e => ({
      id: e.id,
      filename: e.filename,
      importedAt: e.importedAt,
      tableCount: e.tableCount,
      fieldCount: e.fieldCount,
    }));
  }
}
