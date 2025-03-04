import { renderPrompt } from '@vscode/prompt-tsx';
import * as fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { COPILOT_ERROR_MESSAGES, selectChatModel, sendRequestToModel } from '../../services/copilot';
import { Logger } from '../../utils/logger';
import { getWorkspaceFolder } from '../commandUtils';
import { CodeReviewPrompt } from './prompts/codeReviewPrompt';
import { CodeReviewComment, ICodeReviewOptions } from './reviewCodeCommand.types';

/**
 * Retrieves the custom prompt from extension settings or uses the default
 */
export function getCustomPrompt(): string {
  const config = vscode.workspace.getConfiguration('copilotCodeReview');
  return config.get<string>('customPrompt', '');
}

/**
 * Updates the custom prompt in the extension settings
 */
export async function updateCustomPrompt(prompt: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('copilotCodeReview');
  await config.update('customPrompt', prompt, vscode.ConfigurationTarget.Global);
}

/**
 * Regular expressions for parsing file references
 */
const FILE_PATTERNS = {
  /** Match file references in headings */
  HEADING: /^#{1,3} (?:File: |In |)(?:`|)([^`\n:]+)(?:`|)(?::|\n|$)/m,
  /** Match inline file references */
  INLINE: /(?:in|file) [`']?([^`'\n:]+\.[a-zA-Z0-9]+)[`']?/i
};

/**
 * Regular expressions for parsing line number references
 */
const LINE_PATTERNS = {
  /** Match line number references */
  LINE_REF: /(?:line |L)(\d+)(?:-(\d+))?|:(\d+)(?:-(\d+))?:|on line (\d+)(?:-(\d+))?/i
};

/**
 * Streams a code review response to the chat with proper VSCode anchors
 */
export function streamCodeReview(reviewContent: string, stream: vscode.ChatResponseStream): void {
  if (!reviewContent) {
    return;
  }

  try {
    // Parse the review content to extract file references and comments
    const comments = parseReviewComments(reviewContent);

    // If no structured comments were found, just output the original content
    if (comments.length === 0 || !hasFileReferences(comments)) {
      stream.markdown(reviewContent);
      return;
    }

    // Group comments by file
    const fileGroups = groupCommentsByFile(comments);

    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error('Workspace folder not found');
    }

    for (const file of fileGroups.keys()) {
      const docUri = vscode.Uri.parse(workspaceFolder);
      stream.reference(createFileUri(docUri, file));
    }

    // Stream the comments with proper anchors
    streamCommentsWithAnchors(fileGroups, stream);
  } catch (error) {
    Logger.error('Error processing review content', error);
    // Fallback to raw content if processing fails
    stream.markdown(reviewContent);
  }
}

/**
 * Parses the review content to extract file references and comments
 * This uses heuristics to identify file references and line numbers in the text
 */
function parseReviewComments(content: string): CodeReviewComment[] {
  const comments: CodeReviewComment[] = [];

  try {
    // Split the content into sections (usually by headings in markdown)
    const sections = content.split(/(?=^#{1,3} )/m);

    for (const section of sections) {
      const sectionComments = parseSectionComments(section);
      comments.push(...sectionComments);
    }
  } catch (error) {
    Logger.error('Error parsing review comments', error);
  }

  return comments;
}

/**
 * Parses a section of the review content to extract comments
 */
function parseSectionComments(section: string): CodeReviewComment[] {
  const comments: CodeReviewComment[] = [];

  // Try to extract file references from headings
  const fileMatch = section.match(FILE_PATTERNS.HEADING);
  let file = fileMatch ? fileMatch[1].trim() : undefined;

  // If no file was found in the heading, try to find it in the first few lines
  if (!file) {
    const firstLines = section.split('\n').slice(0, 3).join('\n');
    const inlineFileMatch = firstLines.match(FILE_PATTERNS.INLINE);
    if (inlineFileMatch) {
      file = inlineFileMatch[1].trim();
    }
  }

  // Split section into lines or bullet points
  const lines = section.split(/\n(?:[-*+] |(?=\d+\. ))/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines or headings
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    // Try to extract line number references
    const lineNumberMatch = line.match(LINE_PATTERNS.LINE_REF);
    let lineNumbers: number[] | undefined = undefined;

    if (lineNumberMatch) {
      // Extract the first line number (always present if there's a match)
      const firstLine = parseInt(lineNumberMatch[1] || lineNumberMatch[3] || lineNumberMatch[5]);

      // Check if there's a second line number (range)
      const secondLine = lineNumberMatch[2] || lineNumberMatch[4] || lineNumberMatch[6];

      if (secondLine) {
        // We have a range
        lineNumbers = [firstLine, parseInt(secondLine)];
      } else {
        // We have a single line
        lineNumbers = [firstLine];
      }
    }

    // Try to extract file references from the line if not already found
    if (!file) {
      const lineFileMatch = line.match(FILE_PATTERNS.INLINE);
      if (lineFileMatch) {
        file = lineFileMatch[1].trim();
      }
    }

    const contentWithoutLineNumber = line.replace(LINE_PATTERNS.LINE_REF, '').replace(':', '').trim();

    comments.push({
      file,
      lineNumbers,
      comment: contentWithoutLineNumber
    });
  }

  return comments;
}

/**
 * Checks if any comments have file references
 */
function hasFileReferences(comments: CodeReviewComment[]): boolean {
  return comments.some(comment => comment.file);
}

/**
 * Groups comments by file
 */
function groupCommentsByFile(comments: CodeReviewComment[]): Map<string, CodeReviewComment[]> {
  const fileGroups = new Map<string, CodeReviewComment[]>();

  // First, collect all comments with explicit file references
  for (const comment of comments) {
    if (comment.file) {
      if (!fileGroups.has(comment.file)) {
        fileGroups.set(comment.file, []);
      }
      fileGroups.get(comment.file)!.push(comment);
    }
  }

  // If no file groups were created but we have comments, create a default group
  if (fileGroups.size === 0 && comments.length > 0) {
    fileGroups.set('Current File', comments);
  }

  return fileGroups;
}

/**
 * Creates a VSCode URI for a file reference
 */
function createFileUri(baseUri: vscode.Uri, file: string): vscode.Uri {
  try {
    if (file === 'Current File') {
      // Use the current document URI
      return baseUri;
    } else if (baseUri.path.endsWith(file)) {
      // The file name matches the end of the current document URI
      return baseUri;
    } else {
      // Try to construct a URI for a different file in the same directory
      return baseUri.with({ path: baseUri.path + '/' + file });
    }
  } catch (error) {
    Logger.error('Error creating file URI', { baseUri: baseUri.toString(), file, error });
    return baseUri;
  }
}

/**
 * Streams comments with proper VSCode anchors using stream.anchor
 */
function streamCommentsWithAnchors(
  fileGroups: Map<string, CodeReviewComment[]>,
  stream: vscode.ChatResponseStream
): void {
  try {
    // Parse the document URI
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error('Workspace folder not found');
    }

    const docUri = vscode.Uri.parse(workspaceFolder);

    // For each file group, create a section with comments
    for (const [file, comments] of fileGroups.entries()) {
      const fileName = file.split('/').pop();

      stream.markdown(`#### ${fileName} `);
      stream.markdown('\n');

      for (const [index, comment] of comments.entries()) {
        streamCommentWithAnchor(comment, docUri, file, stream, index);
      }
    }
  } catch (error) {
    Logger.error('Error streaming comments with anchors', error);
    // If we can't process with anchors, output as plain markdown
    for (const [file, comments] of fileGroups.entries()) {
      stream.markdown(`## ${file}\n\n`);
      for (const comment of comments) {
        stream.markdown(`- ${comment.comment}\n\n`);
      }
    }
  }
}

/**
 * Streams a single comment with an anchor if applicable
 */
function streamCommentWithAnchor(
  comment: CodeReviewComment,
  docUri: vscode.Uri,
  file: string,
  stream: vscode.ChatResponseStream,
  index: number
): void {
  // Start with the comment text
  const commentText = `- ${comment.comment}`;

  // Add VSCode anchor if we have a line number
  if (comment.lineNumbers && comment.lineNumbers.length > 0) {
    try {
      const targetUri = createFileUri(docUri, file);

      // Format the comment with line numbers, anchor, and content
      stream.markdown(`${index + 1}. `);
      createCustomAnchor(targetUri, comment.lineNumbers, `View code`, stream);
      stream.markdown(`\n${commentText}\n\n`);
    } catch (error) {
      Logger.error('Error creating VSCode anchor', {
        file,
        lineNumbers: comment.lineNumbers,
        error
      });
      // Fallback to simple text if anchor creation fails
      stream.markdown(`${commentText}\n\n`);
    }
  } else {
    // No line numbers, just output the comment text
    stream.markdown(`${commentText}\n\n`);
  }
}

/**
 * Creates an anchor with custom text
 */
function createCustomAnchor(
  targetUri: vscode.Uri,
  lineNumbers: number[] | undefined,
  customText: string,
  stream: vscode.ChatResponseStream
): void {
  try {
    // Default to first line if no line numbers are provided
    if (!lineNumbers || lineNumbers.length === 0) {
      const position = new vscode.Position(0, 0);
      const location = new vscode.Location(targetUri, position);
      stream.anchor(location, customText);
      return;
    }

    // Use the first line number (0-indexed in VSCode)
    const start = new vscode.Position(lineNumbers[0] - 1, 0);
    const end = lineNumbers.length > 1 ? new vscode.Position(lineNumbers[1] - 1, 0) : null;
    const range = end ? new vscode.Range(start, end) : start;
    const location = new vscode.Location(targetUri, range);
    stream.anchor(location, customText);
  } catch (error) {
    Logger.error('Error creating custom anchor', { error });
    // If anchor creation fails, just output the text
    stream.markdown(customText);
  }
}

/**
 * Generates a code review for the given diff
 */
export async function generateCodeReview(
  diffOutput: string,
  _mainBranchName: string,
  changedFiles: Record<string, string>,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<boolean> {
  try {
    // Get custom prompt if available
    const customPrompt = getCustomPrompt();

    // Check for cancellation
    if (token.isCancellationRequested) {
      return false;
    }

    // Get the model to use for code review
    const model = await selectChatModel(token);
    if (!model) {
      stream.markdown(COPILOT_ERROR_MESSAGES.NO_MODEL);
      return false;
    }

    // Create the prompt messages for code review
    const messages = await createPromptMessages(
      {
        selectedCode: diffOutput,
        customPrompt,
        language: 'diff',
        files: changedFiles
      },
      model
    );

    if (!messages) {
      stream.markdown('Failed to create prompt messages for code review');
      return false;
    }

    // Send the request to the language model
    const response = await sendRequestToModel(messages, model, token);

    if (token.isCancellationRequested) {
      return false;
    }

    if (response.error) {
      stream.markdown(`Code review failed: ${response.error}`);
      return false;
    }

    // Stream the response with proper anchors
    streamCodeReview(response.content, stream);

    return true;
  } catch (error) {
    Logger.error('Error creating prompt messages', error);
    stream.markdown('An error occurred during code review');
    return false;
  }
}

/**
 * Creates prompt messages for the code review
 */
async function createPromptMessages(
  options: ICodeReviewOptions,
  model: vscode.LanguageModelChat
): Promise<vscode.LanguageModelChatMessage[] | undefined> {
  try {
    Logger.debug('Rendering prompt for code review');

    const { messages } = await renderPrompt(
      CodeReviewPrompt,
      {
        customPrompt: options.customPrompt,
        selectedCode: options.selectedCode || '',
        language: options.language || 'code',
        files: options.files
      },
      { modelMaxPromptTokens: model.maxInputTokens },
      model
    );

    Logger.debug('Generated messages for code review', {
      messageCount: messages.length
    });

    return messages;
  } catch (error) {
    Logger.error('Error creating prompt messages', error);
    return undefined;
  }
}

/**
 * Gets the content of changed files from the git diff
 */
export async function getChangedFilesContent(
  gitDiff: string,
  workspaceFolder: string
): Promise<Record<string, string>> {
  const changedFiles: Record<string, string> = {};

  try {
    // Extract file paths from git diff
    const filePathRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
    const matches = [...gitDiff.matchAll(filePathRegex)];

    // Get unique file paths (b/ is the new version)
    const filePaths = [...new Set(matches.map(match => match[2]))];

    // Read content of each file
    for (const filePath of filePaths) {
      try {
        const fullPath = path.join(workspaceFolder, filePath);

        // Check if file exists
        if (fs.existsSync(fullPath)) {
          // Read file content
          const content = fs.readFileSync(fullPath, 'utf8');

          // Add to changedFiles object
          changedFiles[filePath] = content;
        }
      } catch (fileError) {
        Logger.warn(`Could not read file ${filePath}`, fileError);
      }
    }
  } catch (error) {
    Logger.error('Error getting changed files content', error);
  }

  return changedFiles;
}
