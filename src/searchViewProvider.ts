import * as vscode from 'vscode';

export class SearchViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sapDictionarySearch';

  private _view?: vscode.WebviewView;
  private _onSearch = new vscode.EventEmitter<string>();
  private _onImport = new vscode.EventEmitter<void>();

  readonly onSearch = this._onSearch.event;
  readonly onImport = this._onImport.event;

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();
    webviewView.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'search') {
        this._onSearch.fire(msg.query as string);
      } else if (msg.type === 'import') {
        this._onImport.fire();
      }
    });
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    padding: 8px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: transparent;
  }
  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
    opacity: 0.7;
    margin-bottom: 5px;
  }
  .import-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    width: 100%;
    background: var(--vscode-button-secondaryBackground, var(--vscode-editor-background));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border: 1px solid var(--vscode-button-border, var(--vscode-widget-border, transparent));
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
    text-align: left;
    line-height: 1.4;
  }
  .import-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
  }
  .import-hint {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-top: 4px;
    line-height: 1.4;
  }
  .divider {
    height: 1px;
    background: var(--vscode-widget-border, var(--vscode-editorWidget-border, rgba(127,127,127,0.2)));
    margin: 10px 0;
  }
  .search-row {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    padding: 0 6px;
    gap: 4px;
  }
  .search-row:focus-within {
    border-color: var(--vscode-focusBorder);
  }
  .search-icon {
    color: var(--vscode-input-placeholderForeground);
    font-size: 14px;
    flex-shrink: 0;
    user-select: none;
  }
  input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--vscode-input-foreground);
    font-size: 13px;
    padding: 5px 0;
    outline: none;
  }
  input::placeholder {
    color: var(--vscode-input-placeholderForeground);
  }
  .search-hint {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-top: 4px;
    line-height: 1.4;
  }
</style>
</head>
<body>

  <!-- Import section (top) -->
  <div class="section-label">Your SAP System</div>
  <button class="import-btn" id="import" title="Import a JSON export from your SAP system to see Z-tables and custom fields">
    📁 Import system metadata (JSON)
  </button>
  <div class="import-hint">Add your Z-tables and custom field descriptions</div>

  <div class="divider"></div>

  <!-- Search section (bottom, adjacent to the tree below) -->
  <div class="section-label">Search</div>
  <div class="search-row">
    <span class="search-icon">⌕</span>
    <input id="search" type="text" placeholder="Table name, field, description…" autocomplete="off" spellcheck="false" />
  </div>
  <div class="search-hint">Filters the table list below · e.g. "MARA", "material"</div>

<script>
  const vscode = acquireVsCodeApi();
  document.getElementById('search').addEventListener('input', function() {
    vscode.postMessage({ type: 'search', query: this.value });
  });
  document.getElementById('import').addEventListener('click', function() {
    vscode.postMessage({ type: 'import' });
  });
</script>
</body>
</html>`;
  }
}
