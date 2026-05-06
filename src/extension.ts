import * as vscode from 'vscode';
import { DataManager } from './dataManager';
import { registerHoverProvider } from './hoverProvider';
import { SidebarProvider } from './sidebarProvider';

let dataManager: DataManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  dataManager = new DataManager(context);
  await dataManager.initialize();

  const config = vscode.workspace.getConfiguration('sapDictionary');
  const productUrl: string = config.get('productUrl') ?? 'https://YOUR_LANDING_PAGE_URL';

  const sidebarProvider = new SidebarProvider(dataManager);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('sapDictionaryTree', sidebarProvider)
  );

  registerHoverProvider(context, dataManager, productUrl);

  context.subscriptions.push(
    vscode.commands.registerCommand('sapDictionary.importData', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'JSON Files': ['json'] },
        openLabel: 'Import SAP Metadata',
      });
      if (!uris || uris.length === 0) { return; }

      try {
        const { tableCount, fieldCount } = await dataManager!.importUserData(uris[0].fsPath);
        sidebarProvider.refresh();
        vscode.window.showInformationMessage(
          `SAP Dictionary: Imported ${tableCount} tables, ${fieldCount} fields.`
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `SAP Dictionary: Import failed — ${(err as Error).message}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('sapDictionary.clearUserData', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all imported SAP metadata?',
        { modal: true },
        'Clear'
      );
      if (confirm === 'Clear') {
        await dataManager!.clearUserData();
        sidebarProvider.refresh();
        vscode.window.showInformationMessage('SAP Dictionary: Imported data cleared.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('sapDictionary.openProduct', () => {
      vscode.env.openExternal(vscode.Uri.parse(productUrl));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('sapDictionary.search', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search SAP tables and fields',
        placeHolder: 'e.g. MARA, material number, vendor...',
      });
      if (query !== undefined) {
        sidebarProvider.setSearchQuery(query);
      }
    })
  );
}

export function deactivate(): void {
  dataManager = undefined;
}
