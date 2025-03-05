import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { CommandOptions, getDiffWithMainBranch, getWorkspaceFolder } from '../commandUtils';
import { generatePRDescriptionWithCopilot, getJiraTicketNumber, getPRTemplate } from './descriptionCommand.helpers';

/**
 * Command options for the description command
 */
export const descriptionCommandOptions: CommandOptions = {
  name: 'description',
  commandKey: 'copilot-code-review.description',
  iconName: 'note',
  commandTrigger: '/write-description'
};

/**
 * Handles the description command
 */
export async function handleDescriptionCommand(
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
  try {
    const diffResult = await getDiffWithMainBranch(workspaceFolder);

    if (!diffResult.diff.trim()) {
      stream.markdown('No code changes detected compared to the main branch.');
      return;
    }

    // Get the PR template
    stream.progress('Fetching PR template...');
    const templateResult = await getPRTemplate(workspaceFolder);

    if (templateResult.error) {
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
        return;
      }

      if (response.error) {
        Logger.error('PR description generation failed', response.error);
        stream.markdown(`PR description generation failed: ${response.error}`);
        return;
      }

      // Output the PR description
      stream.markdown('## Generated PR Description\n\n' + response.content);

      // Add a note about copying
      stream.markdown('\n\n---\n*You can copy this description and use it for your pull request.*');

      // Add a button to copy the description to clipboard
      const copyButton = {
        title: 'Copy to Clipboard',
        command: 'copilot-code-review.copyToClipboard',
        arguments: [response.content]
      };

      stream.button(copyButton);

      // Register the command to copy to clipboard
      vscode.commands.executeCommand('setContext', 'copilot-code-review.hasPRDescription', true);
      vscode.commands.registerCommand('copilot-code-review.copyToClipboard', async (text: string) => {
        try {
          let strippedText = text.replace(/```markdown\n?/g, '').replace(/```\n?/g, '');
          await vscode.env.clipboard.writeText(strippedText);
          vscode.window.showInformationMessage('PR description copied to clipboard');
        } catch (error) {
          Logger.error('Error copying PR description to clipboard', error);
          vscode.window.showErrorMessage('Failed to copy PR description to clipboard');
        }
      });
    } catch (error) {
      Logger.error('Error generating PR description', error);
      stream.markdown('An error occurred while generating the PR description');
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    stream.markdown(errorMessage);
    return;
  }
}
