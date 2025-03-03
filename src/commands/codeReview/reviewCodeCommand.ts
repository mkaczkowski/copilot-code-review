import * as vscode from 'vscode';
import { CommandOptions, getDiffWithMainBranch, getWorkspaceFolder } from '../commandUtils';
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
 * Handles the review code command
 */
export async function handleReviewCodeCommand(
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

  return result;
}
