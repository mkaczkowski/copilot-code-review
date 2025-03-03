import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { reviewCodeWithCopilot } from '../services/copilotService';
import { ICodeReviewOptions, ICodeReviewResult } from '../types';
import { Logger } from '../utils/logger';
import { getCustomPrompt } from '../utils/promptUtils';
import { streamCodeReview } from '../utils/reviewFormatter';

const execAsync = promisify(exec);

/**
 * Error messages for git operations
 */
const GIT_ERROR_MESSAGES = {
  NOT_A_REPO: 'The current workspace is not a git repository.',
  NO_MAIN_BRANCH: 'Main branch not found. Please ensure your repository has a main or master branch.',
  GENERIC_GIT_ERROR: 'Failed to get git diff: '
};

/**
 * Registers the command to review code differences between current state and main branch
 */
export function registerReviewCodeCommand(context: vscode.ExtensionContext) {
  Logger.debug('Registering review code command');

  // Create a chat participant handler for the command
  const handler: vscode.ChatRequestHandler = async (
    request: vscode.ChatRequest,
    chatContext: vscode.ChatContext,
    stream: vscode.ChatResponseStream,
    token: vscode.CancellationToken
  ) => {
    Logger.debug('Review code command invoked via chat', {
      requestText: request.prompt
    });

    try {
      // Get the workspace folder
      const workspaceFolder = getWorkspaceFolder();
      if (!workspaceFolder) {
        stream.markdown('Please open a workspace folder to review code differences.');
        return;
      }

      // Show progress indication
      stream.progress('Analyzing code differences with main branch...');

      // Get the diff with main branch
      const diffResult = await getDiffWithMainBranch(workspaceFolder);

      if (diffResult.error) {
        stream.markdown(diffResult.error);
        return;
      }

      if (!diffResult.diff.trim()) {
        Logger.debug('No differences found with main branch');
        stream.markdown('No code differences found with main branch.');
        return;
      }

      // Create a chat session to display the review
      stream.progress('Analyzing differences...');

      // Generate the code review
      const reviewResult = await generateCodeReview(diffResult.diff, diffResult.mainBranchName, stream, token);

      if (token.isCancellationRequested) {
        return;
      }

      if (!reviewResult) {
        return;
      }

      // Return a result with metadata
      const result: ICodeReviewResult = {
        metadata: {
          workspaceUri: workspaceFolder,
          mainBranchName: diffResult.mainBranchName
        }
      };

      Logger.debug('Returning code review result', result);
      return result;
    } catch (error) {
      handleUnexpectedError(error, stream);
    }
  };

  // Register the chat participant
  const reviewParticipant = vscode.chat.createChatParticipant('copilot-code-review.review', handler);
  reviewParticipant.iconPath = new vscode.ThemeIcon('checklist');
  context.subscriptions.push(reviewParticipant);

  Logger.debug('Review code command registered successfully');
}

/**
 * Gets the workspace folder URI as a string
 * @returns The workspace folder URI or undefined if none found
 */
function getWorkspaceFolder(): string | undefined {
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
 * Result of a git diff operation
 */
interface DiffResult {
  diff: string;
  mainBranchName: string;
  error?: string;
}

/**
 * Gets the diff between the current state and the main branch
 * @param workspaceFolder The workspace folder path
 * @returns Promise resolving to the diff result
 */
async function getDiffWithMainBranch(workspaceFolder: string): Promise<DiffResult> {
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
 * Generates a code review for the given diff
 */
async function generateCodeReview(
  diffOutput: string,
  mainBranchName: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<boolean> {
  try {
    const customPrompt = getCustomPrompt();

    Logger.debug('Using custom prompt for diff review', { customPrompt });

    const options: ICodeReviewOptions = {
      customPrompt,
      selectedCode: diffOutput,
      language: 'diff'
    };

    // Send the request directly to Copilot
    stream.progress('Generating code review...');

    // Use the reviewCodeWithCopilot directly
    const response = await reviewCodeWithCopilot(options, token);

    if (token.isCancellationRequested) {
      Logger.debug('Code review cancelled by user');
      return false;
    }

    if (response.error) {
      Logger.error('Code review failed', response.error);
      stream.markdown(`Code review failed: ${response.error}`);
      return false;
    }

    Logger.debug('Received code review response', {
      responseLength: response.content.length
    });

    // Stream the response to the chat with proper anchors
    Logger.debug('Streaming code review response with anchors');

    // Create a workspace URI to use as a base for anchors
    const workspaceUri = vscode.workspace.workspaceFolders?.[0].uri.toString() || '';
    streamCodeReview(response.content, workspaceUri, stream);

    return true;
  } catch (error) {
    handleUnexpectedError(error, stream);
    return false;
  }
}

/**
 * Handles unexpected errors
 */
function handleUnexpectedError(error: unknown, stream: vscode.ChatResponseStream): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  Logger.error('Unexpected error during code review', error);
  stream.markdown(`An unexpected error occurred: ${errorMessage}`);
}
