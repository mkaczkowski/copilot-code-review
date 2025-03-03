import * as vscode from 'vscode';
import { handleReviewCodeCommand, reviewCodeCommandOptions } from './commands/codeReview/reviewCodeCommand';
import { registerCommandCompletion } from './commands/commandCompletion';
import { registerAllCommandPaletteCommands } from './commands/commandPalette';
import { AVAILABLE_COMMANDS, CommandOptions, handleUnexpectedError } from './commands/commandUtils';
import { descriptionCommandOptions, handleDescriptionCommand } from './commands/writeDescription/descriptionCommand';
import { Logger } from './utils/logger';

const availableCommands: CommandOptions[] = [reviewCodeCommandOptions, descriptionCommandOptions];

let chatParticipant: vscode.ChatParticipant;

export function activate(context: vscode.ExtensionContext) {
  try {
    Logger.initialize(context);
    Logger.info('Copilot Code Review extension is now active!');

    // Register command palette commands first
    registerCommands(context);

    // Register chat participants
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
  context.subscriptions.push(
    vscode.commands.registerCommand('copilot-code-review.showLogs', () => {
      Logger.show();
    })
  );
}

function registerChatParticipants(context: vscode.ExtensionContext): void {
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
    if (request.command === reviewCodeCommandOptions.commandTrigger.replace('/', '')) {
      try {
        return await handleReviewCodeCommand(request, stream, token);
      } catch (error) {
        handleUnexpectedError(error, stream);
        return;
      }
    } else if (request.command === descriptionCommandOptions.commandTrigger.replace('/', '')) {
      try {
        return await handleDescriptionCommand(request, stream, token);
      } catch (error) {
        handleUnexpectedError(error, stream);
        return;
      }
    } else {
      // Extract what command the user tried to use
      const attemptedCommand = request.command || '';

      if (attemptedCommand) {
        stream.markdown(
          `Command \`${attemptedCommand}\` not recognized. Please use one of the available commands:${AVAILABLE_COMMANDS}`
        );
      } else {
        stream.markdown(`Please use one of the available commands:${AVAILABLE_COMMANDS}`);
      }
    }
  };

  // Register the chat participant
  chatParticipant = vscode.chat.createChatParticipant('copilot-code-review.pr', handler);
  chatParticipant.iconPath = new vscode.ThemeIcon('checklist');
  context.subscriptions.push(chatParticipant);

  Logger.debug('Chat participants registered successfully');
}

export function deactivate() {
  try {
    Logger.info('Copilot Code Review extension is deactivated');
    chatParticipant.dispose();
  } catch (error) {
    // Just log to console as the logger might not be available
    console.error('Error during extension deactivation:', error);
  }
}
