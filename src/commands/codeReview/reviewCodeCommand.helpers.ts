import { renderPrompt } from '@vscode/prompt-tsx';
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
  LINE_REF: /(?:line |L)(\d+)|:(\d+):|on line (\d+)/i
};

/**
 * Streams a code review response to the chat with proper VSCode anchors
 */
export function streamCodeReview(reviewContent: string, documentUri: string, stream: vscode.ChatResponseStream): void {
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

    // Stream the comments with proper anchors
    streamCommentsWithAnchors(fileGroups, documentUri, stream);
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
    const lineNumber = lineNumberMatch
      ? parseInt(lineNumberMatch[1] || lineNumberMatch[2] || lineNumberMatch[3])
      : undefined;

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
      lineNumber,
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
  documentUri: string,
  stream: vscode.ChatResponseStream
): void {
  try {
    // Parse the document URI
    const docUri = vscode.Uri.parse(documentUri);

    // For each file group, create a section with comments
    for (const [file, comments] of fileGroups.entries()) {
      stream.markdown(`#### ${file} `);
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
  if (comment.lineNumber !== undefined) {
    try {
      const targetUri = createFileUri(docUri, file);

      // Format the comment with line number, anchor, and content
      stream.markdown(`${index + 1}. `);
      createCustomAnchor(targetUri, comment.lineNumber, `View code`, stream);
      stream.markdown(`\n${commentText}\n\n`);
    } catch (error) {
      Logger.error('Error creating VSCode anchor', {
        file,
        lineNumber: comment.lineNumber,
        error
      });
      // Fallback to simple text if anchor creation fails
      stream.markdown(`${commentText}\n\n`);
    }
  } else {
    // No line number, just output the comment text
    stream.markdown(`${commentText}\n\n`);
  }
}

/**
 * Creates an anchor with custom text
 */
function createCustomAnchor(
  targetUri: vscode.Uri,
  lineNumber: number | undefined,
  customText: string,
  stream: vscode.ChatResponseStream
): void {
  try {
    // Default to first line if no line number is provided
    const line = lineNumber !== undefined ? lineNumber - 1 : 0;
    const position = new vscode.Position(line, 0);
    const location = new vscode.Location(targetUri, position);
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
        language: 'diff'
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
    streamCodeReview(response.content, 'diff', stream);

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
        language: options.language || 'code'
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
 * Sends code to Copilot for review and returns the response
 */
export async function reviewCodeWithCopilot(
  options: ICodeReviewOptions,
  token: vscode.CancellationToken
): Promise<ICopilotResponse> {
  try {
    Logger.debug('Starting code review with Copilot', {
      language: options.language,
      documentUri: options.documentUri,
      codeLength: options.selectedCode?.length || 0
    });

    // Check for cancellation
    if (token.isCancellationRequested) {
      Logger.debug('Code review cancelled before starting');
      return createErrorResponse(COPILOT_ERROR_MESSAGES.CANCELLED);
    }

    // Get the model to use for code review
    const model = await selectChatModel(token);
    if (!model) {
      return createErrorResponse(COPILOT_ERROR_MESSAGES.NO_MODEL);
    }

    // Create the prompt messages
    const messages = await createPromptMessages(options, model);
    if (!messages) {
      return createErrorResponse('Failed to create prompt messages');
    }

    // Send the request to the language model
    return await sendRequestToModel(messages, model, token);
  } catch (error) {
    return handleServiceError(error);
  }
}
