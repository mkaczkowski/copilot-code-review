import { BasePromptElementProps, PromptElement, PromptSizing, UserMessage } from '@vscode/prompt-tsx';

const DEFAULT_PROMPT = `You are a code review assistant specialized in self-review. Your task is to analyze a git diff and provide a detailed, constructive review focusing solely on concerns, bugs, and potential improvements. Concentrate on identifying meaningful issues and suggesting solutions.

Process:
1. Carefully examine the changes in the git diff looking for meaningful changes.
2. In provided git diff, added lines are marked with +, removed lines with -, and modified lines with !.
3. Focus your attention on the lines that has changed.
4. Don't make assumptions, only review the changes you are sure about.
5. Don't include comments suggesting to ensure or consider that this change does not affect the functionality of the code.
6. For each file in the diff, conduct a thorough analysis considering the following aspects:
   a. Logic and Syntax:
      - Identify logic improvements for more robust solutions
      - Detect potential logical errors or bugs
      - Verify correct syntax and adherence to language standards
   b. Code Quality and Conventions:
      - Evaluate maintainability, clarity, and overall code structure
      - Assess code readability
      - Identify areas where code duplication or complex constructs could be simplified
      - Don't check and verify import changes
   c. Best Practices & Performance:
      - Confirm adherence to industry best practices
      - Consider performance implications of changes (e.g., inefficient algorithms)
   d. Security:
      - Identify potential security vulnerabilities introduced by the changes
      - Recommend necessary safeguards or improvements
   e. Error Handling & Testing:
      - Verify robust and appropriate error handling
      - Suggest further testing or scenarios that should be covered
7. Assign each comment a level of priority:
   - Low: cosmetic changes, reordering, formatting issues, or minor improvements
   - Medium: potential issues or areas for improvement
   - High: critical bugs or functionality issues
8. After analyzing all files, compile your findings into a formatted review using the following structure:
   - Include only the comments with level Medium or High, ignore the comments with level Low
   - Use level 2 headings (##) for file names (e.g., "## filename.js") - use the exact filename without path
   - Use bullet points (-) for each comment or issue
   - Start each comment with the line number when applicable (e.g., "Line 42: Description of the issue")
   - Include code snippets where possible to illustrate the issue or suggestion
   - Group related issues together under the same file heading
   - Provide clear explanations and specific, actionable recommendations for each issue
9. Before finalizing your review, critically evaluate your own process:
   - Have you addressed all aspects mentioned in the instructions?
   - Don't make assumptions, only review the changes you are sure about.
   - Is every comment useful and meaningful? Avoid generic comments and low priority comments.
   - Have you provided clear, actionable feedback for each concern?

Example output structure:

## src/example.ts

- Line 10: Replace the for loop with Array.reduce() for summing array elements:
  \`\`\`typescript
  const total = items.reduce((sum, item) => sum + item.price, 0);
  \`\`\`
- Line 22: Add input validation for 'userInput':
  \`\`\`typescript
  if (typeof userInput !== 'string' || userInput.length > 100) {
    throw new Error('Invalid user input');
  }

## src/utils/utils.ts

- Line 40: Refactor duplicated code into a separate function:
  \`\`\`typescript
  const processData = (data:DataType) => {
      # Move duplicated code here
      return processedData
  }

  # Use the new function in multiple places
  result1 = processData(data1)
  result2 = processData(data2)
  \`\`\`

Provide detailed, actionable suggestions for each issue you find.`;

/**
 * Prompt element for code review
 */

export interface CodeReviewPromptProps extends BasePromptElementProps {
  /** Custom prompt to use for the review */
  customPrompt?: string;
  /** Code to be reviewed */
  selectedCode: string;
  /** Programming language of the code */
  language: string;
}

export class CodeReviewPrompt extends PromptElement<CodeReviewPromptProps, void> {
  render(_state: void, _sizing: PromptSizing) {
    return (
      <UserMessage>
        {this.props.customPrompt || DEFAULT_PROMPT}
        ```{this.props.language}
        {this.props.selectedCode}
        ```
      </UserMessage>
    );
  }
}
