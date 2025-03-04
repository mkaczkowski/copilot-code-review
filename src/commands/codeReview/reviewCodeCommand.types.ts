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
  /** Additional files for context, with file path as key and content as value */
  files?: Record<string, string>;
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
  /** Line number(s) in the file. If array has one element, it's a single line reference.
   * If it has two elements, it's a range from first to second line. */
  lineNumbers?: number[];
  /** The actual comment text */
  comment: string;
}

/**
 * Result of a git diff operation
 */
export interface DiffResult {
  diff: string;
  mainBranchName: string;
  error?: string;
}
