import * as vscode from 'vscode';
import { DataManager } from './dataManager';
import { FieldInfo, TableInfo } from './types';

const KEYWORD_BLOCKLIST = new Set([
  // SQL DML / DQL
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','ORDER','BY',
  'GROUP','HAVING','JOIN','LEFT','RIGHT','INNER','OUTER','FULL','ON','AS',
  'DISTINCT','UNION','ALL','INSERT','INTO','UPDATE','SET','DELETE','WITH',
  'CASE','WHEN','THEN','ELSE','END','LIKE','BETWEEN','EXISTS','TOP','LIMIT',
  'OFFSET','OVER','PARTITION','WINDOW','VALUES','USING','NATURAL','CROSS',
  'ASC','DESC','NULLS','FIRST','LAST','FETCH','NEXT','ROWS','ONLY',
  // SQL DDL / DCL
  'CREATE','TABLE','VIEW','DROP','ALTER','ADD','PRIMARY','KEY','FOREIGN',
  'REFERENCES','INDEX','UNIQUE','DEFAULT','CONSTRAINT','CHECK','GRANT',
  'REVOKE','COMMIT','ROLLBACK','BEGIN','TRUNCATE',
  // SQL types (commonly used standalone)
  'INTEGER','VARCHAR','NVARCHAR','CHAR','NCHAR','BIGINT','SMALLINT',
  'DECIMAL','NUMERIC','FLOAT','REAL','DOUBLE','DATE','TIME','TIMESTAMP',
  'BOOLEAN','BINARY','VARBINARY','TEXT','CLOB','BLOB',
  // ABAP keywords
  'IF','ELSE','ELSEIF','ENDIF','DO','ENDDO','LOOP','ENDLOOP','AT','EXIT',
  'DATA','TYPE','LIKE','FIELD','PERFORM','FORM','ENDFORM','CALL','FUNCTION',
  'ENDFUNCTION','CLASS','ENDCLASS','METHOD','ENDMETHOD','INTERFACE',
  'ENDINTERFACE','REPORT','PROGRAM','INCLUDE','WRITE','MOVE','CLEAR',
  'REFRESH','FREE','APPEND','READ','MODIFY','COLLECT','RETURN','RAISE',
  'MESSAGE','AUTHORITY','CHECK','TABLES','PARAMETERS','SELECTION','SCREEN',
  'MODULE','ENDMODULE','PROVIDE','ENDPROVIDE','START','INITIALIZATION',
  'NEW','FINAL','ABSTRACT','STATIC','PUBLIC','PRIVATE','PROTECTED',
  'IMPORTING','EXPORTING','CHANGING','RETURNING','EXCEPTIONS','RAISING',
]);

const aliasMapCache = new Map<string, { version: number; map: Map<string, string> }>();

function buildAliasMap(document: vscode.TextDocument): Map<string, string> {
  const key = document.uri.toString();
  const cached = aliasMapCache.get(key);
  if (cached && cached.version === document.version) {
    return cached.map;
  }
  const map = new Map<string, string>();
  const text = document.getText();
  // Match plain (VBAK), quoted ("com.sap::Entity"), schema-qualified ("SCHEMA"."com.sap::Entity")
  // Alias may start with _ (CDS convention: _carr, _flsch)
  const re = /(?:FROM|JOIN)\s+(?:(?:"[^"]+"|[A-Z][A-Z0-9_]+)\.)?(?:"([^"]+)"|([A-Z][A-Z0-9_]+))\s+(?:AS\s+)?([_A-Za-z][A-Za-z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const table = (m[1] || m[2]).toUpperCase();
    const alias = m[3].toLowerCase();
    if (alias !== table.toLowerCase()) {
      map.set(alias, table);
    }
  }
  aliasMapCache.set(key, { version: document.version, map });
  return map;
}

export function createHoverProvider(dataManager: DataManager, productUrl: string): vscode.HoverProvider {
  return {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
      const wordRange = document.getWordRangeAtPosition(position, /[A-Z][A-Z0-9_]*/);
      if (!wordRange) {
        return null;
      }

      const rawWord = document.getText(wordRange);
      const word = rawWord.toUpperCase();
      if (word.length < 2) {
        return null;
      }

      // Skip SQL and ABAP language keywords
      if (KEYWORD_BLOCKLIST.has(word)) {
        return null;
      }

      // Detect "TABLE~FIELD", "TABLE-FIELD" (ABAP) or "alias.FIELD" / "TABLE.FIELD" (SQL)
      const lineText = document.lineAt(position.line).text;
      const wordStart = wordRange.start.character;
      const precedingText = lineText.substring(0, wordStart);
      const tableFieldMatch = precedingText.match(/([_A-Za-z][A-Za-z0-9_]{0,29})[~\-\.]$/);

      let tableName: string;
      let fieldName: string | undefined;

      if (tableFieldMatch) {
        const qualifier = tableFieldMatch[1];
        // Resolve lowercase alias → real table name using FROM/JOIN clauses
        const aliasMap = buildAliasMap(document);
        tableName = aliasMap.get(qualifier.toLowerCase()) ?? qualifier.toUpperCase();
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
  // Register by language ID for abap and sql (no file-extension collision)
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: 'abap' }, provider),
    vscode.languages.registerHoverProvider({ language: 'sql' }, provider),
  );
  // Register by pattern for .hdb* files — avoids duplicate tooltips when a
  // language extension is also installed that assigns a language ID to these.
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { pattern: '**/*.{hdbview,hdbtable,hdbprocedure,hdbcalculationview}' },
      provider
    )
  );
}
