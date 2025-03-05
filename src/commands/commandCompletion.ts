import * as vscode from 'vscode';
import { reviewCodeCommandOptions } from './codeReview/reviewCodeCommand';
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

    // Check if we're after the /self-review command to provide flag completions
    if (commandPrefix.startsWith(reviewCodeCommandOptions.commandTrigger)) {
      const afterCommand = commandPrefix.substring(reviewCodeCommandOptions.commandTrigger.length).trim();

      // If we're after the command and there's a space, provide flag completions
      if (afterCommand === '' || afterCommand.endsWith(' ')) {
        return this.provideFlagCompletions();
      }

      // If the user is typing a flag, filter the completions
      if (afterCommand.startsWith('-')) {
        return this.provideFlagCompletions(afterCommand);
      }
    }

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

  /**
   * Provides completions for command flags
   */
  private provideFlagCompletions(prefix: string = ''): vscode.CompletionItem[] {
    const flags = [
      {
        flag: '--include-files',
        description: 'Include changed file contents in the review (default)'
      },
      {
        flag: '-i',
        description: 'Include changed file contents in the review (short form, default)'
      }
    ];

    return flags
      .filter(f => f.flag.startsWith(prefix) || prefix === '')
      .map(f => {
        const item = new vscode.CompletionItem(f.flag, vscode.CompletionItemKind.Property);
        item.detail = f.description;
        item.insertText = f.flag;
        item.sortText = f.flag;
        return item;
      });
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
