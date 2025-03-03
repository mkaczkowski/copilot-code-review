import { renderPrompt } from '@vscode/prompt-tsx';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  COPILOT_ERROR_MESSAGES,
  createErrorResponse,
  handleServiceError,
  ICopilotResponse,
  selectChatModel,
  sendRequestToModel
} from '../../services/copilot';
import { Logger } from '../../utils/logger';
import { getWorkspaceFolder, GIT_ERROR_MESSAGES } from '../commandUtils';
import { IPRDescriptionOptions } from './descriptionCommand.types';
import { PRDescriptionPrompt } from './prompts/prDescriptionPrompt';

/**
 * Gets the PR template content from the repository
 */
export async function getPRTemplate(workspaceFolder: string): Promise<{ content: string; error?: string }> {
  try {
    const templatePath = path.join(workspaceFolder, '.github', 'pull_request_template.md');

    // Check if the template file exists
    if (!fs.existsSync(templatePath)) {
      Logger.debug('PR template not found at', { templatePath });
      return { content: '', error: GIT_ERROR_MESSAGES.NO_PR_TEMPLATE };
    }

    // Read the template file
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    Logger.debug('PR template found', { templateLength: templateContent.length });

    return { content: templateContent };
  } catch (error) {
    Logger.error('Error reading PR template', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { content: '', error: `Failed to read PR template: ${errorMessage}` };
  }
}

/**
 * Sends git diff and PR template to Copilot for generating a PR description
 */
export async function generatePRDescriptionWithCopilot(
  options: IPRDescriptionOptions,
  token: vscode.CancellationToken
): Promise<ICopilotResponse> {
  try {
    Logger.debug('Starting PR description generation with Copilot', {
      gitDiffLength: options.gitDiff.length,
      templateLength: options.prTemplate.length
    });

    // Check for cancellation
    if (token.isCancellationRequested) {
      Logger.debug('PR description generation cancelled before starting');
      return createErrorResponse(COPILOT_ERROR_MESSAGES.CANCELLED);
    }

    // Get the model to use for PR description
    const model = await selectChatModel(token);
    if (!model) {
      return createErrorResponse(COPILOT_ERROR_MESSAGES.NO_MODEL);
    }

    // Create the prompt messages for PR description
    const messages = await createPRDescriptionPromptMessages(options, model);
    if (!messages) {
      return createErrorResponse('Failed to create prompt messages for PR description');
    }

    // Send the request to the language model
    return await sendRequestToModel(messages, model, token);
  } catch (error) {
    return handleServiceError(error);
  }
}

/**
 * Creates prompt messages for PR description generation
 */
async function createPRDescriptionPromptMessages(
  options: IPRDescriptionOptions,
  model: vscode.LanguageModelChat
): Promise<vscode.LanguageModelChatMessage[] | undefined> {
  try {
    Logger.debug('Rendering prompt for PR description');

    const { messages } = await renderPrompt(
      PRDescriptionPrompt,
      {
        customPrompt: options.customPrompt,
        gitDiff: options.gitDiff,
        prTemplate: options.prTemplate
      },
      { modelMaxPromptTokens: model.maxInputTokens },
      model
    );

    Logger.debug('Generated messages for PR description', {
      messageCount: messages.length
    });

    return messages;
  } catch (error) {
    Logger.error('Error creating PR description prompt messages', error);
    return undefined;
  }
}

/**
 * Extracts the JIRA ticket number from the current branch name
 * Expected format: abc-123-branch-name
 */
export function getJiraTicketNumber(): string {
  try {
    // Get the current branch name
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
      Logger.debug('No workspace folder found when getting JIRA ticket number');
      return 'UNKNOWN';
    }

    // Execute git command synchronously
    const branchName = execSync('git rev-parse --abbrev-ref HEAD', { cwd: workspaceFolder }).toString().trim();

    Logger.debug(`Current branch name: ${branchName}`);

    // Extract JIRA ticket number using regex
    // Format: ABC-123 (project code, followed by hyphen, followed by numbers)
    const jiraTicketRegex = /^([a-zA-Z]+-\d+)/i;
    const match = branchName.match(jiraTicketRegex);

    if (match && match[1]) {
      // Convert to uppercase for consistency
      return match[1].toUpperCase();
    }

    Logger.debug('No JIRA ticket number found in branch name');
    return 'UNKNOWN';
  } catch (error) {
    Logger.error('Error getting JIRA ticket number', error);
    return 'UNKNOWN';
  }
}
