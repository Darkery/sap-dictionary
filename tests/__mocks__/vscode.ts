// Minimal vscode mock — only the surface DataManager touches
export const ExtensionContext = {};
export const window = {};
export const workspace = {};
export const env = {};
export const commands = {};
export const languages = {};
export const Uri = { parse: (s: string) => s };
