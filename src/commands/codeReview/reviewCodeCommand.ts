import * as vscode from 'vscode';
import { CommandOptions, getDiffWithMainBranch, getWorkspaceFolder } from '../commandUtils';
import { generateCodeReview, getChangedFilesContent } from './reviewCodeCommand.helpers';
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
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<ICodeReviewResult | undefined> {
  // Parse command arguments
  const includeFiles = parseIncludeFilesFlag(request);

  // Get the workspace folder
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    stream.markdown('Please open a workspace folder to review code differences.');
    return;
  }

  // Show progress indication
  stream.progress('Analyzing code differences with main branch...');

  // Get the diff with main branch
  try {
    const diffResult = await getDiffWithMainBranch(workspaceFolder);

    if (!diffResult.diff.trim()) {
      stream.markdown('No code changes detected compared to the main branch.');
      return;
    }

    // Collect changed files for additional context if the flag is set
    let changedFiles: Record<string, string> = {};
    if (includeFiles) {
      stream.progress('Collecting changed files content for context...');
      changedFiles = await getChangedFilesContent(diffResult.diff, workspaceFolder);
    } else {
      stream.progress(
        'Skipping changed files content collection (add `--include-files` or `-i` flag to add file content)'
      );
    }

    // Create a chat session to display the review
    stream.progress('Analyzing differences...');

    // Generate the code review
    const reviewResult = await generateCodeReview(
      diffResult.diff,
      diffResult.mainBranchName,
      changedFiles,
      stream,
      token
    );

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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    stream.markdown(errorMessage);
    return;
  }
}

/**
 * Parses the include-files flag from the request
 * Supports both --include-files and -i formats
 * By default, files are included unless explicitly disabled
 */
function parseIncludeFilesFlag(request: vscode.ChatRequest): boolean {
  if (!request.prompt) {
    return false;
  }

  const prompt = request.prompt.toLowerCase();
  return prompt.includes('--include-files') || prompt.includes('-i');
}
