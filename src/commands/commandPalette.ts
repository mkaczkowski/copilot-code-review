import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { CommandOptions } from './commandUtils';

/**
 * Registers a command to be available in the command palette
 * @param context The extension context
 * @param options The command options
 */
export function registerCommandPaletteCommand(context: vscode.ExtensionContext, options: CommandOptions): void {

  // Register the command with VS Code
  const disposable = vscode.commands.registerCommand(options.commandKey, async () => {
    try {
      // Open the chat view if it's not already open
      await vscode.commands.executeCommand('workbench.action.chat.open');

      // Insert the command in the chat input
      await vscode.commands.executeCommand('workbench.action.chat.insertParticipant', '@pr');
      await vscode.commands.executeCommand('workbench.action.chat.insertText', ` ${options.commandTrigger}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`Error executing command ${options.commandKey}:`, error);
      vscode.window.showErrorMessage(
        `Copilot Code Review: This command requires the GitHub Copilot Chat extension to be installed and activated. Error: ${errorMessage}`
      );
    }
  });

  context.subscriptions.push(disposable);
}

/**
 * Registers all commands to be available in the command palette
 * @param context The extension context
 * @param commands Array of command options to register
 */
export function registerAllCommandPaletteCommands(context: vscode.ExtensionContext, commands: CommandOptions[]): void {

  commands.forEach(command => {
    registerCommandPaletteCommand(context, command);
  });

}
