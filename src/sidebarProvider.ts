import * as vscode from 'vscode';
import { DataManager } from './dataManager';
import { SearchItem } from './types';

export class TableItem extends vscode.TreeItem {
  constructor(
    public readonly tableName: string,
    public readonly tableDescription: string
  ) {
    super(tableName, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = tableDescription;
    this.tooltip = tableDescription;
    this.contextValue = 'table';
  }
}

export class FieldItem extends vscode.TreeItem {
  constructor(
    public readonly tableName: string,
    public readonly fieldName: string,
    public readonly fieldDescription: string,
    showTableContext = false
  ) {
    super(fieldName, vscode.TreeItemCollapsibleState.None);
    this.description = showTableContext
      ? `${tableName}${fieldDescription ? '  ' + fieldDescription : ''}`
      : fieldDescription;
    this.tooltip = showTableContext
      ? `${tableName} · ${fieldName}\n${fieldDescription}`
      : fieldDescription;
    this.contextValue = 'field';
  }
}

export class SidebarProvider implements vscode.TreeDataProvider<TableItem | FieldItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TableItem | FieldItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private searchQuery = '';
  private filteredTables: string[] = [];
  private filteredFieldResults: SearchItem[] = [];

  constructor(private readonly dataManager: DataManager) {
    this.refreshTableList();
  }

  private refreshTableList(): void {
    this.filteredFieldResults = [];
    if (!this.searchQuery) {
      this.filteredTables = this.dataManager.getAllTableNames();
      return;
    }

    const results = this.dataManager.search(this.searchQuery);
    const seenTables = new Set<string>();
    const seenFields = new Set<string>();
    this.filteredTables = [];

    for (const r of results) {
      if (r.fieldName) {
        // Field-level match → show field directly at root with table context
        const key = `${r.tableName}~${r.fieldName}`;
        if (!seenFields.has(key)) {
          seenFields.add(key);
          this.filteredFieldResults.push(r);
        }
      } else {
        // Table-level match → show as collapsible table item
        if (!seenTables.has(r.tableName)) {
          seenTables.add(r.tableName);
          this.filteredTables.push(r.tableName);
        }
      }
    }
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.refreshTableList();
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this.refreshTableList();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TableItem | FieldItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TableItem | FieldItem): (TableItem | FieldItem)[] {
    if (!element) {
      const tableItems = this.filteredTables.map(name => {
        const info = this.dataManager.getTableInfo(name);
        return new TableItem(name, info?.description ?? '');
      });
      const fieldItems = this.filteredFieldResults.map(r =>
        new FieldItem(r.tableName, r.fieldName!, r.fieldDescription ?? '', true)
      );
      return [...tableItems, ...fieldItems];
    }

    if (element instanceof TableItem) {
      const info = this.dataManager.getTableInfo(element.tableName);
      if (!info) { return []; }
      return Object.entries(info.fields).map(
        ([fieldName, fieldInfo]) => new FieldItem(element.tableName, fieldName, fieldInfo.description)
      );
    }

    return [];
  }
}
