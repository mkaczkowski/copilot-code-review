import { BasePromptElementProps, PromptElement, PromptSizing, UserMessage } from '@vscode/prompt-tsx';

const DEFAULT_PROMPT = `You are tasked with writing a pull request (PR) GitHub template based on a provided git diff and an existing PR template. This task involves analyzing the changes in the code and using that information to fill out a comprehensive PR description.

Process:
1. Analyze the git diff:
   - Identify the files that have been changed
   - Determine the nature of the changes (e.g., bug fixes, new features, refactoring, tests, ci, docs)
   - Note any significant additions or deletions
2. Use the provided PR template as a base for your response. You will fill out each section with relevant information based on the git diff analysis.
3. For each section of the PR template:
   - Title: Create a concise title that summarizes the main purpose of the changes
   - Description: Provide a detailed explanation of what the changes accomplish and why they were made
   - Type of change: Select the appropriate type(s) based on the nature of the changes
   - How Has This Been Tested?: Describe any testing that has been done or needs to be done
   - Checklist: Mark the relevant items based on the changes and any project-specific requirements
4. Ensure that your responses are clear, concise, and directly related to the changes shown in the git diff.
5. If there are any sections in the template that cannot be filled based on the information in the git diff, indicate that additional information is needed.
6. Output your completed pull request template

Make sure to fill out all sections of the template based on the information from the git diff, using placeholder text or notes where necessary if certain information cannot be inferred from the diff alone.`;

export interface PRDescriptionPromptProps extends BasePromptElementProps {
  /** Custom prompt to use for the PR description */
  customPrompt?: string;
  /** Git diff to analyze */
  gitDiff: string;
  /** PR template content */
  prTemplate: string;
}

/**
 * Prompt element for PR description generation
 */
export class PRDescriptionPrompt extends PromptElement<PRDescriptionPromptProps, void> {
  render(_state: void, _sizing: PromptSizing) {
    return (
      <UserMessage>
        {this.props.customPrompt || DEFAULT_PROMPT}
        ## PR Template: ```markdown
        {this.props.prTemplate}
        ``` ## Git Diff: ```diff
        {this.props.gitDiff}
        ``` Please generate a PR description following the template structure above.
      </UserMessage>
    );
  }
}
