import * as vscode from 'vscode';
import { DataManager } from './dataManager';
import { registerHoverProvider } from './hoverProvider';
import { SidebarProvider } from './sidebarProvider';
import { SearchViewProvider } from './searchViewProvider';

let dataManager: DataManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const dm = new DataManager(context);
  dataManager = dm;
  await dm.initialize();

  const config = vscode.workspace.getConfiguration('sapDictionary');
  const productUrl: string = config.get('productUrl') ?? 'https://YOUR_LANDING_PAGE_URL';

  // Sidebar: search webview (top) + tree (bottom)
  const searchProvider = new SearchViewProvider();
  const sidebarProvider = new SidebarProvider(dm);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SearchViewProvider.viewType, searchProvider),
    vscode.window.registerTreeDataProvider('sapDictionaryTree', sidebarProvider),
  );

  // Wire search input → tree filter
  context.subscriptions.push(
    searchProvider.onSearch(query => sidebarProvider.setSearchQuery(query))
  );

  // Wire import button in webview → import command
  context.subscriptions.push(
    searchProvider.onImport(() => vscode.commands.executeCommand('sapDictionary.importData'))
  );

  registerHoverProvider(context, dm, productUrl);

  const doImport = async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'JSON Files': ['json'] },
      openLabel: 'Import SAP Metadata',
    });
    if (!uris || uris.length === 0) { return; }
    try {
      const { tableCount, fieldCount } = await dm.importUserData(uris[0].fsPath);
      sidebarProvider.refresh();
      vscode.window.showInformationMessage(
        `SAP Dictionary: Imported ${tableCount} tables, ${fieldCount} fields.`
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `SAP Dictionary: Import failed — ${(err as Error).message}`
      );
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('sapDictionary.importData', doImport),

    vscode.commands.registerCommand('sapDictionary.clearUserData', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all imported SAP metadata?',
        { modal: true },
        'Clear'
      );
      if (confirm === 'Clear') {
        await dm.clearUserData();
        sidebarProvider.refresh();
        vscode.window.showInformationMessage('SAP Dictionary: Imported data cleared.');
      }
    }),

    vscode.commands.registerCommand('sapDictionary.openProduct', () => {
      vscode.env.openExternal(vscode.Uri.parse(productUrl));
    }),

    // Keep command palette search as fallback
    vscode.commands.registerCommand('sapDictionary.search', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search SAP tables and fields',
        placeHolder: 'e.g. MARA, material number, vendor...',
      });
      if (query !== undefined) {
        sidebarProvider.setSearchQuery(query);
      }
    }),
  );
}

export function deactivate(): void {
  dataManager = undefined;
}
