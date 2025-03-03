import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { DiffResult } from './codeReview/reviewCodeCommand.types';

const execAsync = promisify(exec);

/**
 * Common interface for command options
 */
export interface CommandOptions {
  name: string;
  commandKey: string;
  iconName: string;
  commandTrigger: string;
}

/**
 * Available commands information
 */
export const AVAILABLE_COMMANDS = `
## Available Commands

- \`@pr /self-review\` - Review your code changes compared to the main branch
- \`@pr /write-desc\` - Generate a description for your code changes
- \`@pr /all\` - Show this list of available commands

Type any of these commands to get started.
`;

/**
 * Error messages for git operations
 */
export const GIT_ERROR_MESSAGES = {
  NOT_A_REPO: 'The current workspace is not a git repository.',
  NO_MAIN_BRANCH: 'Main branch not found. Please ensure your repository has a main or master branch.',
  GENERIC_GIT_ERROR: 'Failed to get git diff: ',
  NO_PR_TEMPLATE: 'No PR template found at .github/pull_request_template.md.'
};

/**
 * Handles the common command checking logic
 */
export function handleCommandChecks(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  commandTrigger: string
): boolean {
  Logger.debug(`Command invoked via chat`, {
    requestText: request.prompt
  });

  // Check if this is a command to list all available commands
  if (request.prompt.includes('/all')) {
    stream.markdown(AVAILABLE_COMMANDS);
    return false;
  }

  // Check if this is just '@pr' without any specific command
  if (request.prompt.trim().match(/^@pr(\s*)$/i)) {
    stream.markdown(`# Welcome to Copilot Code Review

This extension helps you review and document your code changes.

${AVAILABLE_COMMANDS}

Need help? Type \`@pr /all\` at any time to see this list again.`);
    return false;
  }

  // Check if this is the expected command
  if (!request.prompt.includes(commandTrigger)) {
    // Extract what command the user tried to use
    const match = request.prompt.match(/@pr\s+(\S+)/i);
    const attemptedCommand = match ? match[1] : '';

    if (attemptedCommand) {
      stream.markdown(
        `Command \`${attemptedCommand}\` not recognized. Please use one of the available commands:${AVAILABLE_COMMANDS}`
      );
    } else {
      stream.markdown(
        `Please use \`${commandTrigger}\` to execute this command or \`/all\` to see all available commands.`
      );
    }
    return false;
  }

  return true;
}

/**
 * Handles unexpected errors
 */
export function handleUnexpectedError(error: unknown, stream: vscode.ChatResponseStream): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  Logger.error('Unexpected error during command execution', error);
  stream.markdown(`An unexpected error occurred: ${errorMessage}`);
}

/**
 * Gets the workspace folder URI as a string
 */
export function getWorkspaceFolder(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    Logger.debug('No workspace folder found');
    return undefined;
  }

  const workspaceFolder = workspaceFolders[0].uri.fsPath;
  Logger.debug('Using workspace folder', { workspaceFolder });
  return workspaceFolder;
}

/**
 * Gets the diff between the current state and the main branch
 */
export async function getDiffWithMainBranch(workspaceFolder: string): Promise<DiffResult> {
  try {
    // Check if main branch exists
    const { stdout: branchesOutput } = await execAsync('git branch -a', { cwd: workspaceFolder });
    const mainBranchName = branchesOutput.includes('main') ? 'main' : 'master';
    Logger.debug(`Using ${mainBranchName} as the main branch`);

    // Get the diff
    const { stdout: diffOutput } = await execAsync(`git diff ${mainBranchName}`, { cwd: workspaceFolder });

    return {
      diff: diffOutput,
      mainBranchName
    };
  } catch (error) {
    Logger.error('Error getting diff with main branch', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('not a git repository')) {
      return { diff: '', mainBranchName: '', error: GIT_ERROR_MESSAGES.NOT_A_REPO };
    } else if (errorMessage.includes('did not match any')) {
      return { diff: '', mainBranchName: '', error: GIT_ERROR_MESSAGES.NO_MAIN_BRANCH };
    } else {
      return { diff: '', mainBranchName: '', error: GIT_ERROR_MESSAGES.GENERIC_GIT_ERROR + errorMessage };
    }
  }
}

/**
 * Registers a command with common patterns
 * @param context The extension context
 * @param options The command options
 * @param handlerFn The handler function for the command
 */
export function registerCommand(
  context: vscode.ExtensionContext,
  options: CommandOptions,
  handlerFn: (
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => Promise<any>
): void {
  Logger.debug(`Registering ${options.name} command`);

  // Create a chat participant handler for the command
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    _chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
    // Check if this is a valid command
    if (!handleCommandChecks(request, stream, options.commandTrigger)) {
      return;
    }

    try {
      return await handlerFn(request, stream, token);
    } catch (error) {
      handleUnexpectedError(error, stream);
      return;
    }
  };

  // Register the chat participant
  const participant = vscode.chat.createChatParticipant(options.commandKey, handler);
  participant.iconPath = new vscode.ThemeIcon(options.iconName);
  context.subscriptions.push(participant);

  Logger.debug(`${options.name} command registered successfully`);
}
