/**
 * Options for PR description generation
 */
export interface IPRDescriptionOptions {
  /** Custom prompt to use for the PR description */
  customPrompt?: string;
  /** Git diff to analyze */
  gitDiff: string;
  /** PR template content */
  prTemplate: string;
}
