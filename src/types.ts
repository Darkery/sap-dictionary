export interface FieldInfo {
  description: string;
  type?: string;
  length?: number;
  is_key?: boolean;
  data_element?: string;
}

export interface TableInfo {
  description: string;
  category?: string;
  fields: Record<string, FieldInfo>;
}

export interface SapDataFile {
  exported_at: string;
  source?: string;
  system?: string;
  tables: Record<string, TableInfo>;
}

export interface LookupResult {
  tableName: string;
  tableInfo: TableInfo;
  fieldName?: string;
  fieldInfo?: FieldInfo;
}

export interface SearchItem {
  tableName: string;
  tableDescription: string;
  fieldName?: string;
  fieldDescription?: string;
}

export interface ImportEntry {
  id: string;
  filename: string;
  importedAt: string;
  tableCount: number;
  fieldCount: number;
  tables: Record<string, TableInfo>;
}

export interface ImportEntryMeta {
  id: string;
  filename: string;
  importedAt: string;
  tableCount: number;
  fieldCount: number;
}
