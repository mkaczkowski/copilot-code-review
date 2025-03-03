import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export const COPILOT_ERROR_MESSAGES = {
  NO_MODEL: 'No suitable language model found for code review',
  CANCELLED: 'Operation cancelled by user',
  UNKNOWN: 'An unknown error occurred during code review'
};

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
 *
/**
 * Selects an appropriate chat model for code review
 */
export async function selectChatModel(token: vscode.CancellationToken): Promise<vscode.LanguageModelChat | undefined> {
  try {
    Logger.debug('Selecting chat model for code review');

    if (token.isCancellationRequested) {
      Logger.debug('Model selection cancelled');
      return undefined;
    }

    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      // Prefer GPT-4o if available, but fall back to other models
      family: 'gpt-4o'
    });

    if (!models || models.length === 0) {
      Logger.error(COPILOT_ERROR_MESSAGES.NO_MODEL);
      return undefined;
    }

    const model = models[0];
    Logger.debug('Selected model for code review', {
      modelId: model.id,
      modelName: model.name,
      maxInputTokens: model.maxInputTokens
    });

    return model;
  } catch (error) {
    Logger.error('Error selecting chat model', error);
    return undefined;
  }
}

/**
 * Sends a request to the language model and processes the response
 */
export async function sendRequestToModel(
  messages: vscode.LanguageModelChatMessage[],
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken
): Promise<ICopilotResponse> {
  try {
    Logger.debug('Sending request to language model');

    // Check for cancellation
    if (token.isCancellationRequested) {
      Logger.debug('Request cancelled before sending');
      return createErrorResponse(COPILOT_ERROR_MESSAGES.CANCELLED);
    }

    const chatResponse = await model.sendRequest(messages, {}, token);

    // Get the full response text
    let responseContent = '';
    Logger.debug('Starting to receive response fragments');

    for await (const fragment of chatResponse.text) {
      if (token.isCancellationRequested) {
        Logger.debug('Operation cancelled during response streaming');
        return createErrorResponse(COPILOT_ERROR_MESSAGES.CANCELLED);
      }
      responseContent += fragment;
    }

    Logger.debug('Completed receiving response', {
      responseLength: responseContent.length
    });

    // Return the raw response content - formatting will be handled by the reviewParticipant
    return {
      content: responseContent
    };
  } catch (error) {
    return handleServiceError(error);
  }
}

/**
 * Creates an error response
 */
export function createErrorResponse(errorMessage: string): ICopilotResponse {
  return {
    content: '',
    error: errorMessage
  };
}

/**
 * Handles errors in the service
 */
export function handleServiceError(error: unknown): ICopilotResponse {
  if (error instanceof Error) {
    Logger.error('Error during code review with Copilot', error);
    return createErrorResponse(error.message);
  }

  Logger.error('Unknown error during code review with Copilot', { error });
  return createErrorResponse(COPILOT_ERROR_MESSAGES.UNKNOWN);
}
