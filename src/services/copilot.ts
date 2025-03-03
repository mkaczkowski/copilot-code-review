import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { CodeReviewPrompt } from '../prompts/codeReviewPrompt';
import { ICodeReviewOptions, ICopilotResponse } from '../types';
import { Logger } from '../utils/logger';

/**
 * Error messages for Copilot service
 */
const ERROR_MESSAGES = {
  NO_MODEL: 'No suitable language model found for code review',
  CANCELLED: 'Operation cancelled by user',
  UNKNOWN: 'An unknown error occurred during code review'
};

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
      return createErrorResponse(ERROR_MESSAGES.CANCELLED);
    }

    // Get the model to use for code review
    const model = await selectChatModel(token);
    if (!model) {
      return createErrorResponse(ERROR_MESSAGES.NO_MODEL);
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

/**
 * Selects an appropriate chat model for code review
 */
async function selectChatModel(token: vscode.CancellationToken): Promise<vscode.LanguageModelChat | undefined> {
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
      Logger.error(ERROR_MESSAGES.NO_MODEL);
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
 * Sends a request to the language model and processes the response
 */
async function sendRequestToModel(
  messages: vscode.LanguageModelChatMessage[],
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken
): Promise<ICopilotResponse> {
  try {
    Logger.debug('Sending request to language model');

    // Check for cancellation
    if (token.isCancellationRequested) {
      Logger.debug('Request cancelled before sending');
      return createErrorResponse(ERROR_MESSAGES.CANCELLED);
    }

    const chatResponse = await model.sendRequest(messages, {}, token);

    // Get the full response text
    let responseContent = '';
    Logger.debug('Starting to receive response fragments');

    for await (const fragment of chatResponse.text) {
      if (token.isCancellationRequested) {
        Logger.debug('Operation cancelled during response streaming');
        return createErrorResponse(ERROR_MESSAGES.CANCELLED);
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
function createErrorResponse(errorMessage: string): ICopilotResponse {
  return {
    content: '',
    error: errorMessage
  };
}

/**
 * Handles errors in the service
 */
function handleServiceError(error: unknown): ICopilotResponse {
  if (error instanceof Error) {
    Logger.error('Error during code review with Copilot', error);
    return createErrorResponse(error.message);
  }

  Logger.error('Unknown error during code review with Copilot', { error });
  return createErrorResponse(ERROR_MESSAGES.UNKNOWN);
}
