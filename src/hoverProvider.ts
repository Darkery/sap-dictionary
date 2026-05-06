import * as vscode from 'vscode';
import { DataManager } from './dataManager';
import { FieldInfo, TableInfo } from './types';

const SUPPORTED_LANGUAGES = [
  'abap',
  'sql',
  'hdbview',
  'hdbcalculationview',
  'hdbtable',
  'hdbprocedure',
];

export function createHoverProvider(dataManager: DataManager, productUrl: string): vscode.HoverProvider {
  return {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
      const wordRange = document.getWordRangeAtPosition(position, /[A-Z][A-Z0-9_]*/);
      if (!wordRange) {
        return null;
      }

      const word = document.getText(wordRange).toUpperCase();
      if (word.length < 2) {
        return null;
      }

      // Detect "TABLE~FIELD" or "TABLE-FIELD" context (ABAP field access)
      const lineText = document.lineAt(position.line).text;
      const wordStart = wordRange.start.character;
      const precedingText = lineText.substring(0, wordStart);
      const tableFieldMatch = precedingText.match(/([A-Z][A-Z0-9_]{1,29})[~\-]$/);

      let tableName: string;
      let fieldName: string | undefined;

      if (tableFieldMatch) {
        tableName = tableFieldMatch[1];
        fieldName = word;
      } else {
        tableName = word;
      }

      const result = dataManager.lookup(tableName, fieldName);

      if (!result) {
        return buildNotFoundHover(tableName, productUrl);
      }

      if (fieldName && !result.fieldInfo) {
        return buildFieldNotFoundHover(tableName, fieldName, result.tableInfo.description, productUrl);
      }

      if (result.fieldInfo) {
        return result.fieldInfo.description
          ? buildDescriptionHover(result.tableName, fieldName!, result.fieldInfo)
          : buildNoDescriptionHover(result.tableName, fieldName!, result.fieldInfo, productUrl);
      }

      return buildTableHover(result.tableName, result.tableInfo);
    },
  };
}

function buildDescriptionHover(tableName: string, fieldName: string, field: FieldInfo): vscode.Hover {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.appendMarkdown(`**${fieldName}** · \`${tableName}\`\n\n`);
  md.appendMarkdown(`${field.description}\n\n`);
  const meta: string[] = [];
  if (field.type) { meta.push(`Type: \`${field.type}\``); }
  if (field.length) { meta.push(`Length: ${field.length}`); }
  if (meta.length) { md.appendMarkdown(meta.join('  ') + '\n\n'); }
  if (field.data_element) { md.appendMarkdown(`Data Element: \`${field.data_element}\``); }
  return new vscode.Hover(md);
}

function buildNoDescriptionHover(
  tableName: string, fieldName: string,
  field: FieldInfo, productUrl: string
): vscode.Hover {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.appendMarkdown(`**${fieldName}** · \`${tableName}\`\n\n`);
  md.appendMarkdown(`*No description available*\n\n`);
  const meta: string[] = [];
  if (field.type) { meta.push(`Type: \`${field.type}\``); }
  if (field.length) { meta.push(`Length: ${field.length}`); }
  if (meta.length) { md.appendMarkdown(meta.join('  ') + '\n\n'); }
  md.appendMarkdown(`[Get AI-powered descriptions →](${productUrl})\n\n`);
  md.appendMarkdown(`*Import your metadata · [Open Product](${productUrl})*`);
  return new vscode.Hover(md);
}

function buildNotFoundHover(tableName: string, productUrl: string): vscode.Hover {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.appendMarkdown(`**${tableName}**\n\n`);
  md.appendMarkdown(`*Not found in SAP Dictionary*\n\n`);
  md.appendMarkdown(`Import your system's metadata to see custom tables · [Open Product](${productUrl})`);
  return new vscode.Hover(md);
}

function buildFieldNotFoundHover(
  tableName: string, fieldName: string,
  tableDesc: string, productUrl: string
): vscode.Hover {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.appendMarkdown(`**${fieldName}** · \`${tableName}\`\n\n`);
  if (tableDesc) { md.appendMarkdown(`Table: ${tableDesc}\n\n`); }
  md.appendMarkdown(`*Field not found in SAP Dictionary*\n\n`);
  md.appendMarkdown(`[Import your system metadata](${productUrl})`);
  return new vscode.Hover(md);
}

function buildTableHover(tableName: string, table: TableInfo): vscode.Hover {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.appendMarkdown(`**${tableName}**\n\n`);
  if (table.description) { md.appendMarkdown(`${table.description}\n\n`); }
  const meta: string[] = [];
  if (table.category) { meta.push(`Category: \`${table.category}\``); }
  meta.push(`Fields: ${Object.keys(table.fields).length}`);
  md.appendMarkdown(meta.join('  '));
  return new vscode.Hover(md);
}

export function registerHoverProvider(
  context: vscode.ExtensionContext,
  dataManager: DataManager,
  productUrl: string
): void {
  const provider = createHoverProvider(dataManager, productUrl);
  for (const lang of SUPPORTED_LANGUAGES) {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider({ language: lang }, provider)
    );
  }
  // Also catch .hdb* files that VS Code may not have a language ID for
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { pattern: '**/*.{abap,hdbview,hdbtable,hdbprocedure,hdbcalculationview}' },
      provider
    )
  );
}
