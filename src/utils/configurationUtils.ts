import * as vscode from 'vscode';

/**
 * Retrieves the custom prompt from extension settings or uses the default
 */
export function getCustomPrompt(): string {
  const config = vscode.workspace.getConfiguration('copilotCodeReview');
  return config.get<string>('customPrompt', '');
}

/**
 * Updates the custom prompt in the extension settings
 */
export async function updateCustomPrompt(prompt: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('copilotCodeReview');
  await config.update('customPrompt', prompt, vscode.ConfigurationTarget.Global);
}
