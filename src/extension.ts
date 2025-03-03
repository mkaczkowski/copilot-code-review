import * as vscode from 'vscode';
import { registerReviewCodeCommand, reviewCodeCommandOptions } from './commands/codeReview/reviewCodeCommand';
import { registerCommandCompletion } from './commands/commandCompletion';
import { registerAllCommandPaletteCommands } from './commands/commandPalette';
import { CommandOptions } from './commands/commandUtils';
import { descriptionCommandOptions, registerDescriptionCommand } from './commands/writeDescription/descriptionCommand';
import { Logger } from './utils/logger';

const availableCommands: CommandOptions[] = [reviewCodeCommandOptions, descriptionCommandOptions];

export function activate(context: vscode.ExtensionContext) {
  try {
    Logger.initialize(context);
    Logger.info('Copilot Code Review extension is now active!');

    registerCommands(context);

    registerChatParticipants(context);

    // Register command palette commands
    registerAllCommandPaletteCommands(context, availableCommands);

    // Register command completion
    registerCommandCompletion(context, availableCommands);

    Logger.info('Extension initialization completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    Logger.error('Error during extension activation', error);
    vscode.window.showErrorMessage(`Copilot Code Review: Error during activation - ${errorMessage}`);
  }
}

function registerCommands(context: vscode.ExtensionContext): void {
  Logger.debug('Registering extension commands');
  context.subscriptions.push(
    vscode.commands.registerCommand('copilot-code-review.showLogs', () => {
      Logger.show();
    })
  );
}

function registerChatParticipants(context: vscode.ExtensionContext): void {
  Logger.debug('Registering chat participants');
  registerReviewCodeCommand(context);
  registerDescriptionCommand(context);
}

export function deactivate() {
  try {
    Logger.info('Copilot Code Review extension is deactivated');
  } catch (error) {
    // Just log to console as the logger might not be available
    console.error('Error during extension deactivation:', error);
  }
}
