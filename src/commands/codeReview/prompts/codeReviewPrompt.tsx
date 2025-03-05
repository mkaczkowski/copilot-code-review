import { BasePromptElementProps, PromptElement, PromptSizing, UserMessage } from '@vscode/prompt-tsx';
import { getLanguageFromFilePath } from '../../../utils/language';

const DEFAULT_PROMPT = `
## Instructions
You are a code review assistant specialized in self-review. Your task is to analyze a git diff and provide a detailed, constructive feedback focusing solely on concerns, bugs, and potential improvements.

## Process
1. Carefully examine the changes in the git diff looking for meaningful changes.
2. In the git diff, added lines are preceded by +, removed lines by -, and modified lines by !.
3. For each file in the diff, conduct a thorough analysis considering the following aspects:
   a. Logic and Syntax:
      - Identify logic improvements for more robust solutions
      - Detect potential logical errors or bugs
   b. Code Quality and Conventions:
      - Evaluate maintainability, clarity, and overall code structure
      - Assess code readability
      - Identify areas where code duplication or complex constructs could be simplified
   c. Best Practices & Performance:
      - Confirm adherence to industry best practices
      - Consider performance implications of changes (e.g., inefficient algorithms)
   d. Security:
      - Identify potential security vulnerabilities introduced by the changes
      - Recommend necessary safeguards or improvements
   e. Error Handling & Testing:
      - Verify robust and appropriate error handling
      - Suggest further testing or scenarios that should be covered
4. Don't make assumptions, only raise concerns about the changes you are sure about.
5. Skip comments about import statements entirely, Don't check or comments about ordering or missing imports!
6. Skip comments about changed return types, only raise concerns about the changes you are sure about.
7. Don't include comments suggesting to ensure or consider that this change does not affect the functionality of the code.
8. Assign each comment a level of priority:
   - Low: cosmetic changes, reordering, formatting issues, or minor improvements
   - Medium: potential issues or areas for improvement
   - High: critical bugs or functionality issues
9. Don't include comments about the code that is not changed.

## Output Format
After analyzing all files, compile your findings into a formatted review using the following structure:
  - Include only the comments with level Medium or High, ignore the comments with level Low
  - Use level 2 headings (##) for file names (e.g., "## filename.js") - use the exact filename without path
  - Use bullet points (-) for each comment or issue
  - Start each comment with the line number when applicable (e.g., "Line 42: Description of the issue")
  - Include the 'before' code block snippet to show referenced, current state of the code and 'after' with proposed improvement (but only if applicable) to illustrate the problem and the suggested solution. Keep the code block minimal, showing only the essential code that needs to be changed to keep the comment relevant.
  - Group related issues together under the same file heading
  - Provide clear explanations and specific, actionable recommendations for each issue

## Finalization
Before finalizing your review, critically evaluate your own process:
  - Have you addressed all aspects mentioned in the instructions?
  - Is every comment useful and meaningful? Skip generic comments, and low priority comments.
  - Have you provided clear, actionable feedback for each concern, bug or improvement?

## Example Output

## src/example.ts

- Line 10: Replace the for loop with Array.reduce() for summing array elements
  ### before
  \`\`\`typescript
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  \`\`\`
  ### after
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
  ### before
  \`\`\`typescript
   result1 = someFunction.map(data1).filter(filterFn).reduce(reduceFn)
   result2 = someFunction.map(data2).filter(filterFn).reduce(reduceFn)
  \`\`\`
  ### after
  \`\`\`typescript
  const processData = (data:DataType) => {
      return someFunction.map(data).filter(filterFn).reduce(reduceFn)
  }

  # Use the new function in multiple places
  result1 = processData(data1)
  result2 = processData(data2)
  \`\`\`
`;

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
  /** Additional context files */
  files?: Record<string, string>;
}

export class CodeReviewPrompt extends PromptElement<CodeReviewPromptProps, void> {
  render(_state: void, _sizing: PromptSizing) {
    const filesEntries = this.props.files ? Object.entries(this.props.files) : [];

    return (
      <UserMessage>
        {this.props.customPrompt || DEFAULT_PROMPT}
        ```{this.props.language}
        {this.props.selectedCode}
        ```
        {filesEntries.length > 0 ? (
          <>
            {`\n\n`}
            {`## Additional Context Files`}
            {filesEntries.map(([filePath, content]) => (
              <>
                {`\n\n`}
                {`### ${filePath}`}
                {`\`\`\`${getLanguageFromFilePath(filePath)}\n${content}\n\`\`\``}
              </>
            ))}
          </>
        ) : (
          ''
        )}
      </UserMessage>
    );
  }
}
