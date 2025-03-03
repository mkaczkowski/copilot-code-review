import { BasePromptElementProps, PromptElement, PromptSizing, UserMessage } from '@vscode/prompt-tsx';

export interface CodeReviewPromptProps extends BasePromptElementProps {
  /** Custom prompt to use for the review */
  customPrompt: string;
  /** Code to be reviewed */
  selectedCode: string;
  /** Programming language of the code */
  language: string;
}

/**
 * Prompt element for code review
 */
export class CodeReviewPrompt extends PromptElement<CodeReviewPromptProps, void> {
  render(_state: void, _sizing: PromptSizing) {
    return (
      <>
        {/* prettier-ignore */}
        <UserMessage>
          I need you to act as a code review assistant. Carefully analyze the git diff, paying attention to all aspects of the changes.
          Provide a detailed, constructive review.

          Focus on:
          1. Logic and Syntax:
            - Identify logic improvements for more robust solutions
            - Check for potential logical errors or bugs
            - Verify correct syntax and adherence to language standards
          2. Code Quality and Conventions:
            - Evaluate maintainability, clarity, and overall code structure
            - Assess code readability
            - Identify areas where code duplication or complex constructs could be simplified
            - Check consistency across altered code
          3. Best Practices & Performance:
            - Confirm adherence to industry best practices
            - Consider performance implications of changes (e.g., inefficient algorithms)
          4. Security:
            - Identify potential security vulnerabilities introduced by the changes
            - Recommend necessary safeguards or improvements
          5. Error Handling & Testing:
            - Verify robust and appropriate error handling
            - Suggest further testing or scenarios that should be covered

          Format your response with Markdown using the following structure:
          1. Use level 2 headings (##) for file names (e.g., "## filename.js") - use the exact filename without path
          2. Use bullet points (-) for each comment or issue
          3. Start each comment with the line number when applicable (e.g., "Line 42: Description of the issue"). Don't decorate the line number with any other text or Markdown.
          4. Include code snippets where possible
          5. Group related issues together under the same file heading
          6. Provide clear explanations and specific recommendations for each issue

          Before finalizing your review, critically evaluate your own process
          - Have you addressed all aspects mentioned in the instructions?
          - Is your review comprehensive and effective?
          - Have you provided clear, actionable feedback for each concern?

          {this.props.customPrompt}

          ```{this.props.language}
          {this.props.selectedCode}
          ```
        </UserMessage>
      </>
    );
  }
}
