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
    padding: 6px 8px 8px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: transparent;
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
    outline: none;
  }
  .search-icon {
    color: var(--vscode-input-placeholderForeground);
    font-size: 14px;
    flex-shrink: 0;
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
  .import-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    padding: 5px 8px;
    width: 100%;
    background: var(--vscode-button-secondaryBackground, var(--vscode-editor-background));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
    text-align: left;
  }
  .import-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
  }
</style>
</head>
<body>
  <div class="search-row">
    <span class="search-icon">⌕</span>
    <input id="search" type="text" placeholder="Search tables &amp; fields…" autocomplete="off" spellcheck="false" />
  </div>
  <button class="import-btn" id="import">
    <span>📁</span> Import system data…
  </button>
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
