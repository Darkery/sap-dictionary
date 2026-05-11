import * as vscode from 'vscode';
import { ImportEntryMeta } from './types';

export class SearchViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sapDictionarySearch';

  private _view?: vscode.WebviewView;
  private _onSearch = new vscode.EventEmitter<string>();
  private _onImport = new vscode.EventEmitter<void>();
  private _onClear = new vscode.EventEmitter<void>();
  private _onDeleteImport = new vscode.EventEmitter<string>();

  readonly onSearch = this._onSearch.event;
  readonly onImport = this._onImport.event;
  readonly onClear = this._onClear.event;
  readonly onDeleteImport = this._onDeleteImport.event;

  constructor(private readonly getEntries: () => ImportEntryMeta[]) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml(this.getEntries());
    webviewView.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'search') {
        this._onSearch.fire(msg.query as string);
      } else if (msg.type === 'import') {
        this._onImport.fire();
      } else if (msg.type === 'clear') {
        this._onClear.fire();
      } else if (msg.type === 'deleteImport') {
        this._onDeleteImport.fire(msg.id as string);
      }
    });
  }

  updateImportEntries(entries: ImportEntryMeta[]): void {
    this._view?.webview.postMessage({ type: 'importEntries', entries });
  }

  private getHtml(initialEntries: ImportEntryMeta[]): string {
    const entriesJson = JSON.stringify(initialEntries);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    padding: 8px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: transparent;
    line-height: 1.4;
  }

  /* ── Import button ── */
  .btn-import {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 6px 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    font-weight: 500;
    letter-spacing: 0.02em;
    transition: background 0.1s;
  }
  .btn-import:hover { background: var(--vscode-button-hoverBackground); }
  .btn-import:active { opacity: 0.85; }
  .btn-import svg { flex-shrink: 0; }

  /* ── Hint text ── */
  .hint {
    margin-top: 4px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
  }

  /* ── Imported files section ── */
  .section {
    margin-top: 10px;
  }
  .section.hidden { display: none; }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 5px;
  }
  .section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vscode-foreground);
    opacity: 0.5;
  }
  .btn-link {
    font-size: 11px;
    color: var(--vscode-textLink-foreground);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    opacity: 0.8;
  }
  .btn-link:hover { opacity: 1; text-decoration: underline; }

  /* ── File card ── */
  .file-card {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 6px 5px 8px;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
    background: var(--vscode-list-inactiveSelectionBackground, rgba(128,128,128,0.08));
    margin-bottom: 4px;
    min-width: 0;
    transition: background 0.1s;
  }
  .file-card:hover {
    background: var(--vscode-list-hoverBackground);
    border-color: var(--vscode-focusBorder, rgba(128,128,128,0.3));
  }
  .file-icon { flex-shrink: 0; opacity: 0.6; }
  .file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .file-name {
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--vscode-foreground);
  }
  .file-meta {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
  }
  .badge {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 10px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    white-space: nowrap;
  }
  .btn-remove {
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    padding: 2px 4px;
    font-size: 14px;
    line-height: 1;
    border-radius: 3px;
    font-family: inherit;
    opacity: 0.6;
    transition: opacity 0.1s, background 0.1s;
  }
  .btn-remove:hover {
    opacity: 1;
    background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-errorForeground, #f48771);
  }

  /* ── Divider ── */
  .divider {
    height: 1px;
    background: var(--vscode-widget-border, rgba(128,128,128,0.2));
    margin: 10px 0;
  }

  /* ── Search ── */
  .search-row {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    padding: 0 7px;
    gap: 5px;
  }
  .search-row:focus-within {
    border-color: var(--vscode-focusBorder);
    outline: none;
  }
  .search-icon { color: var(--vscode-input-placeholderForeground); flex-shrink: 0; user-select: none; }
  input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--vscode-input-foreground);
    font-size: 12px;
    padding: 5px 0;
    outline: none;
    font-family: inherit;
  }
  input::placeholder { color: var(--vscode-input-placeholderForeground); }
</style>
</head>
<body>

  <button class="btn-import" id="import">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 1v7.586L4.707 6.293 3.293 7.707 8 12.414l4.707-4.707-1.414-1.414L9 8.586V1H7z"/>
      <path d="M2 14h12v-2H2v2z"/>
    </svg>
    Import System Metadata
  </button>
  <p class="hint">Add Z-tables and custom field descriptions</p>

  <div class="section hidden" id="imports-section">
    <div class="section-header">
      <span class="section-label">Imported Files</span>
      <button class="btn-link" id="clear-all">Clear all</button>
    </div>
    <div id="imports-list"></div>
  </div>

  <div class="divider"></div>

  <div class="search-row">
    <svg class="search-icon" width="13" height="13" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398l3.85 3.85-.708.707-3.85-3.85a6.5 6.5 0 0 0 1.398-1.397zM6.5 12a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" fill-rule="evenodd"/>
    </svg>
    <input id="search" type="text" placeholder="Table, field, or description…" autocomplete="off" spellcheck="false" />
  </div>
  <p class="hint" style="margin-top:3px">Filters the table list · e.g. "MARA", "material"</p>

<script>
  const vscode = acquireVsCodeApi();

  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
  }

  const fileIconSvg = '<svg class="file-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 0h7l4 4v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1zm7 0v4h4l-4-4z" fill-rule="evenodd"/></svg>';

  function renderImports(entries) {
    const section = document.getElementById('imports-section');
    const list = document.getElementById('imports-list');
    if (!entries || entries.length === 0) {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');
    list.innerHTML = entries.map(e =>
      '<div class="file-card">' +
        fileIconSvg +
        '<div class="file-info">' +
          '<span class="file-name" title="' + e.filename + '">' + e.filename + '</span>' +
          '<span class="file-meta">' + relativeTime(e.importedAt) + '</span>' +
        '</div>' +
        '<span class="badge">' + e.tableCount + 't</span>' +
        '<button class="btn-remove" data-id="' + e.id + '" title="Remove ' + e.filename + '">&#215;</button>' +
      '</div>'
    ).join('');
    list.querySelectorAll('.btn-remove').forEach(function(btn) {
      btn.addEventListener('click', function() {
        vscode.postMessage({ type: 'deleteImport', id: btn.dataset.id });
      });
    });
  }

  window.addEventListener('message', function(event) {
    if (event.data.type === 'importEntries') {
      renderImports(event.data.entries);
    }
  });

  document.getElementById('search').addEventListener('input', function() {
    vscode.postMessage({ type: 'search', query: this.value });
  });
  document.getElementById('import').addEventListener('click', function() {
    vscode.postMessage({ type: 'import' });
  });
  document.getElementById('clear-all').addEventListener('click', function() {
    vscode.postMessage({ type: 'clear' });
  });

  // Render initial state from embedded data
  renderImports(${entriesJson});
</script>
</body>
</html>`;
  }
}
