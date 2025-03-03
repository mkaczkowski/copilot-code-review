import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { CommandOptions, getDiffWithMainBranch, getWorkspaceFolder, registerCommand } from '../commandUtils';
import { generateCodeReview } from './reviewCodeCommand.helpers';
import { ICodeReviewResult } from './reviewCodeCommand.types';

/**
 * Command options for the review code command
 */
export const reviewCodeCommandOptions: CommandOptions = {
  name: 'review code',
  commandKey: 'copilot-code-review.review',
  iconName: 'checklist',
  commandTrigger: '/self-review'
};

/**
 * Registers the command to review code differences between current state and main branch
 */
export function registerReviewCodeCommand(context: vscode.ExtensionContext) {
  registerCommand(context, reviewCodeCommandOptions, handleReviewCodeCommand);
}

/**
 * Handles the review code command
 */
async function handleReviewCodeCommand(
  _request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<ICodeReviewResult | undefined> {
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
}
