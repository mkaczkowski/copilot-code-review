import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { CommandOptions, getDiffWithMainBranch, getWorkspaceFolder, registerCommand } from '../commandUtils';
import { generatePRDescriptionWithCopilot, getJiraTicketNumber, getPRTemplate } from './descriptionCommand.helpers';

/**
 * Command options for the description command
 */
export const descriptionCommandOptions: CommandOptions = {
  name: 'description',
  commandKey: 'copilot-code-review.description',
  iconName: 'note',
  commandTrigger: '/write-desc'
};

/**
 * Registers the command to write description for code changes
 */
export function registerDescriptionCommand(context: vscode.ExtensionContext) {
  registerCommand(context, descriptionCommandOptions, handleDescriptionCommand);
}

/**
 * Handles the description command
 */
async function handleDescriptionCommand(
  _request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<void> {
  // Get the workspace folder
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    stream.markdown('Please open a workspace folder to generate a PR description.');
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

  // Get the PR template
  stream.progress('Fetching PR template...');
  const templateResult = await getPRTemplate(workspaceFolder);

  if (templateResult.error) {
    Logger.debug('No PR template found');
    stream.markdown(`#### Missing PR Template

To create a PR template:
1. Create a \`.github\` directory in your repository root
2. Add a \`pull_request_template.md\` file inside that directory
3. Define your PR template structure

Would you like to continue with a basic template? If so, please create the template file first.
`);
    return;
  }

  let prTemplate = templateResult.content;

  // Replace JIRA ticket number placeholder if present
  prTemplate = prTemplate.replace('JIRA_TICKET_NUMBER', getJiraTicketNumber());

  // Generate the PR description
  stream.progress('Generating PR description...');

  try {
    // Generate the PR description
    const response = await generatePRDescriptionWithCopilot(
      {
        gitDiff: diffResult.diff,
        prTemplate
      },
      token
    );

    if (token.isCancellationRequested) {
      Logger.debug('PR description generation cancelled by user');
      return;
    }

    if (response.error) {
      Logger.error('PR description generation failed', response.error);
      stream.markdown(`PR description generation failed: ${response.error}`);
      return;
    }

    // Output the PR description
    Logger.debug('PR description generated successfully');
    stream.markdown('## Generated PR Description\n\n' + response.content);

    // Add a note about copying
    stream.markdown('\n\n---\n*You can copy this description and use it for your pull request.*');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    Logger.error('Error generating PR description', error);
    stream.markdown(`Error generating PR description: ${errorMessage}`);
  }
}
