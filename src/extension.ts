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
  const productUrl: string = config.get('productUrl') ?? 'https://rosetta-landing.pages.dev';

  const searchProvider = new SearchViewProvider(() => dm.getImportEntries());
  const sidebarProvider = new SidebarProvider(dm);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SearchViewProvider.viewType, searchProvider),
    vscode.window.registerTreeDataProvider('sapDictionaryTree', sidebarProvider),
  );

  context.subscriptions.push(
    searchProvider.onSearch(query => sidebarProvider.setSearchQuery(query)),
    searchProvider.onImport(() => vscode.commands.executeCommand('sapDictionary.importData')),
    searchProvider.onClear(() => vscode.commands.executeCommand('sapDictionary.clearUserData')),
    searchProvider.onDeleteImport(id => vscode.commands.executeCommand('sapDictionary.deleteImport', id)),
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
      searchProvider.updateImportEntries(dm.getImportEntries());
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

    vscode.commands.registerCommand('sapDictionary.deleteImport', async (id: string) => {
      const entry = dm.getImportEntries().find(e => e.id === id);
      const label = entry?.filename ?? 'this import';
      const confirm = await vscode.window.showWarningMessage(
        `Remove "${label}" from imported metadata?`,
        { modal: true },
        'Remove'
      );
      if (confirm !== 'Remove') { return; }
      await dm.deleteImportEntry(id);
      sidebarProvider.refresh();
      searchProvider.updateImportEntries(dm.getImportEntries());
    }),

    vscode.commands.registerCommand('sapDictionary.clearUserData', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all imported SAP metadata?',
        { modal: true },
        'Clear'
      );
      if (confirm === 'Clear') {
        await dm.clearUserData();
        sidebarProvider.refresh();
        searchProvider.updateImportEntries([]);
        vscode.window.showInformationMessage('SAP Dictionary: Imported data cleared.');
      }
    }),

    vscode.commands.registerCommand('sapDictionary.openProduct', () => {
      vscode.env.openExternal(vscode.Uri.parse(productUrl));
    }),

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
