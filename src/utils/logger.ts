import * as vscode from 'vscode';

/**
 * Log levels for the application
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel;
  private static debugMode: boolean = false;

  /**
   * Initialize the logger
   */
  public static initialize(context: vscode.ExtensionContext): void {
    this.outputChannel = vscode.window.createOutputChannel('Copilot Code Review');
    context.subscriptions.push(this.outputChannel);

    // Check if debug mode is enabled in settings
    this.debugMode = vscode.workspace.getConfiguration('copilotCodeReview').get('enableDebugLogging', false);

    // Log initialization
    this.info('Logger initialized');
    this.debug('Debug logging is ' + (this.debugMode ? 'enabled' : 'disabled'));
  }

  /**
   * Log a debug message (only in debug mode)
   */
  public static debug(message: string, data?: any): void {
    if (this.debugMode) {
      this.log(LogLevel.DEBUG, message, data);
    }
  }

  /**
   * Log an info message
   */
  public static info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   */
  public static warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   */
  public static error(message: string, error?: any): void {
    this.log(LogLevel.ERROR, message, error);
  }

  /**
   * Internal log method
   */
  private static log(level: LogLevel, message: string, data?: any): void {
    if (!this.outputChannel) {
      console.log(`[${level}] ${message}`);
      if (data) console.log(data);
      return;
    }

    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;

    if (data) {
      if (data instanceof Error) {
        logMessage += `\n    Error: ${data.message}`;
        if (data.stack) {
          logMessage += `\n    Stack: ${data.stack}`;
        }
      } else if (typeof data === 'object') {
        try {
          logMessage += `\n    Data: ${JSON.stringify(data, null, 2)}`;
        } catch (e) {
          logMessage += `\n    Data: [Object that couldn't be stringified]`;
        }
      } else {
        logMessage += `\n    Data: ${data}`;
      }
    }

    this.outputChannel.appendLine(logMessage);
  }

  /**
   * Show the output channel
   */
  public static show(): void {
    if (this.outputChannel) {
      this.outputChannel.show();
    }
  }
}
