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
  - \`--include-files\` or \`-i\` - Include changed file contents in the review
- \`@pr /write-description\` - Generate a description for your code changes
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
    return undefined;
  }

  const workspaceFolder = workspaceFolders[0].uri.fsPath;
  return workspaceFolder;
}

/**
 * Determines the main branch name (main or master)
 */
export async function determineMainBranchName(workspaceFolder: string): Promise<string> {
  try {
    const { stdout: branchesOutput } = await execAsync('git branch -a', { cwd: workspaceFolder });

    // Use regex to find actual branch names (either local or remote)
    // This will match patterns like "main", "* main", "remotes/origin/main", but not "subdomain" or "feature/main-enhancement"
    const hasMainBranch = /(\*\s+main|\smain$|\/main$)/m.test(branchesOutput);
    const hasMasterBranch = /(\*\s+master|\smaster$|\/master$)/m.test(branchesOutput);

    if (hasMainBranch) {
      return 'main';
    } else if (hasMasterBranch) {
      return 'master';
    } else {
      // No main or master branch found
      throw new Error(GIT_ERROR_MESSAGES.NO_MAIN_BRANCH);
    }
  } catch (error) {
    Logger.error('Error determining main branch name', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('not a git repository')) {
      throw new Error(GIT_ERROR_MESSAGES.NOT_A_REPO);
    } else if (errorMessage === GIT_ERROR_MESSAGES.NO_MAIN_BRANCH) {
      throw error;
    } else {
      throw new Error(GIT_ERROR_MESSAGES.GENERIC_GIT_ERROR + errorMessage);
    }
  }
}

/**
 * Gets the diff between the current state and the specified branch
 * @throws Error if there's an issue getting the git diff
 */
export async function getGitDiff(workspaceFolder: string, branchName: string): Promise<string> {
  try {
    const { stdout: diffOutput } = await execAsync(`git diff origin/${branchName}  -- . ':(exclude)yarn.lock'`, {
      cwd: workspaceFolder
    });

    return diffOutput;
  } catch (error) {
    Logger.error('Error getting git diff', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('did not match any')) {
      throw new Error(GIT_ERROR_MESSAGES.NO_MAIN_BRANCH);
    } else {
      throw new Error(GIT_ERROR_MESSAGES.GENERIC_GIT_ERROR + errorMessage);
    }
  }
}

/**
 * Gets the diff between the current state and the main branch
 */
export async function getDiffWithMainBranch(workspaceFolder: string): Promise<DiffResult> {
  try {
    const mainBranchName = await determineMainBranchName(workspaceFolder);
    const diff = await getGitDiff(workspaceFolder, mainBranchName);

    return { diff, mainBranchName };
  } catch (error) {
    Logger.error('Error getting diff with main branch', error);
    throw error; // Re-throw the error to be handled by the caller
  }
}
