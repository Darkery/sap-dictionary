import * as vscode from 'vscode';
import { DataManager } from './dataManager';

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
    public readonly fieldDescription: string
  ) {
    super(fieldName, vscode.TreeItemCollapsibleState.None);
    this.description = fieldDescription;
    this.tooltip = fieldDescription;
    this.contextValue = 'field';
  }
}

export class SidebarProvider implements vscode.TreeDataProvider<TableItem | FieldItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TableItem | FieldItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private searchQuery = '';
  private filteredTables: string[] = [];

  constructor(private readonly dataManager: DataManager) {
    this.refreshTableList();
  }

  private refreshTableList(): void {
    if (!this.searchQuery) {
      this.filteredTables = this.dataManager.getAllTableNames().slice(0, 200);
    } else {
      const results = this.dataManager.search(this.searchQuery);
      const seen = new Set<string>();
      this.filteredTables = [];
      for (const r of results) {
        if (!seen.has(r.tableName)) {
          seen.add(r.tableName);
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
      return this.filteredTables.map(name => {
        const info = this.dataManager.getTableInfo(name);
        return new TableItem(name, info?.description ?? '');
      });
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
