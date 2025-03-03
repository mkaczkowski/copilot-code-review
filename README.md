# Copilot Code Review

A VS Code extension that leverages GitHub Copilot to review your changes and suggest improvements. This extension helps you improve code quality by providing AI-powered code reviews directly in your editor.

## Features

- **Instant Code Reviews**: Get immediate feedback on your code without waiting for team reviews
- **Git-Based Analysis**: Automatically compares your local changes to the main branch of your repository
- **Language Agnostic**: Works with any programming language supported by GitHub Copilot
- **Customizable**: Tailor the review focus with custom prompts
- **Precise Navigation**: Jump directly to the specific code locations mentioned in reviews
- **Markdown Formatting**: Well-structured reviews with file sections and line references

## Installation

### Prerequisites

- Visual Studio Code 1.95.0 or higher
- GitHub Copilot extension must be installed and properly configured
- Git repository with a main branch (main or master)

### Install from VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Copilot Code Review"
4. Click Install

## Usage

### Reviewing Code Changes

This extension works by comparing your local changes to the main branch of your Git repository:

1. Open a Git repository in VS Code
2. Make changes to your code
3. Open a Copilot Chat
4. Run the command `@review`
5. The extension will automatically detect differences with the main branch and review them

## Extension Settings

This extension contributes the following settings:

- `copilotCodeReview.customPrompt`: Customize the prompt sent to Copilot for code review (default: "Please review this code for bugs, errors, and improvements:")
- `copilotCodeReview.enableDebugLogging`: Enable debug logging for the extension (default: true)

## Known Issues

- This extension requires the official GitHub Copilot extension to be installed
- Performance may vary depending on the size and complexity of the code being reviewed
- Very large files or diffs may be truncated due to token limits
- The extension requires a Git repository with a main branch (main or master)

## Privacy and Security

This extension sends code to GitHub Copilot for analysis. Please review our [Security Policy](SECURITY.md) for more information about data handling and best practices.

## Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more information.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
