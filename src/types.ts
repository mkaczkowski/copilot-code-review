/**
 * Options for code review requests
 */
export interface ICodeReviewOptions {
  /** Custom prompt to use for the review */
  customPrompt?: string;
  /** Code to be reviewed */
  selectedCode?: string;
  /** URI of the document being reviewed */
  documentUri?: string;
  /** Programming language of the code */
  language?: string;
}

/**
 * Response from Copilot code review
 */
export interface ICopilotResponse {
  /** Content of the response */
  content: string;
  /** Error message if the request failed */
  error?: string;
}

/**
 * Represents a file reference in a diff
 */
export interface IDiffFileReference {
  /** File path */
  path: string;
  /** Line number in the file */
  lineNumber?: number;
}

/**
 * Result of a code review operation
 */
export interface ICodeReviewResult {
  /** Metadata about the review */
  metadata: {
    /** URI of the document or workspace */
    documentUri?: string;
    /** Programming language */
    language?: string;
    /** Selection range in the document */
    selectionRange?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    /** Main branch name for diff reviews */
    mainBranchName?: string;
    /** Workspace URI for diff reviews */
    workspaceUri?: string;
  };
}

/**
 * Interface representing a code review comment
 */
export interface CodeReviewComment {
  /** File the comment refers to */
  file?: string;
  /** Line number in the file */
  lineNumber?: number;
  /** The actual comment text */
  comment: string;
}
