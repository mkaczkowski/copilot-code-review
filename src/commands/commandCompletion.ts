import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { CommandOptions } from './commandUtils';

/**
 * A completion item provider for chat commands
 */
export class CommandCompletionProvider implements vscode.CompletionItemProvider {
  private commands: CommandOptions[];

  constructor(commands: CommandOptions[]) {
    this.commands = commands;
  }

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
    // Get the current line text up to the cursor position
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    // Check if we're in a chat input and after '@pr '
    if (!linePrefix.includes('@pr')) {
      return undefined;
    }

    // Only provide completions if we're right after '@pr' or '@pr '
    const prIndex = linePrefix.lastIndexOf('@pr');
    const textAfterPr = linePrefix.substring(prIndex + 3);

    // If there's text after @pr but it's not starting with a space, don't show completions
    if (textAfterPr.length > 0 && !textAfterPr.startsWith(' ')) {
      return undefined;
    }

    // Extract the text after '@pr ' to see what the user has typed so far
    const commandPrefix = textAfterPr.trim();

    // Create completion items for each command that matches the prefix
    const completionItems = this.commands
      .filter(cmd => cmd.commandTrigger.startsWith(commandPrefix) || commandPrefix === '')
      .map(cmd => {
        const item = new vscode.CompletionItem(cmd.commandTrigger, vscode.CompletionItemKind.Method);
        item.detail = `${cmd.name} command`;
        item.insertText = cmd.commandTrigger;
        item.sortText = cmd.commandTrigger;
        return item;
      });

    return completionItems;
  }
}

/**
 * Registers the command completion provider
 * @param context The extension context
 * @param commands Array of command options to provide completion for
 */
export function registerCommandCompletion(context: vscode.ExtensionContext, commands: CommandOptions[]): void {

  // Register the completion provider for chat input
  const provider = new CommandCompletionProvider(commands);
  const disposable = vscode.languages.registerCompletionItemProvider(
    { scheme: 'vscode-chat' }, // This targets the chat input
    provider,
    ' ' // Trigger completion after typing space (after @pr)
  );

  context.subscriptions.push(disposable);
}
