# Contributing to Copilot Code Review

Thank you for your interest in contributing to Copilot Code Review! This document provides guidelines and instructions for contributing to this project.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with the following information:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- VS Code version
- Extension version
- Any relevant screenshots or error messages

### Suggesting Features

We welcome feature suggestions! Please create an issue on GitHub with:

- A clear, descriptive title
- Detailed description of the proposed feature
- Any relevant examples or mockups
- Explanation of why this feature would be useful to most users

### Pull Requests

1. Fork the repository
2. Create a new branch for your changes
3. Make your changes
4. Add or update tests as necessary
5. Ensure all tests pass
6. Update documentation as needed
7. Submit a pull request

#### Development Setup

1. Clone your fork of the repository
2. Install dependencies with `npm install`
3. Make your changes
4. Build the extension with `npm run compile`
5. Test your changes with `F5` to launch a new VS Code window with the extension loaded

#### Coding Guidelines

- Follow the existing code style
- Write clear, descriptive commit messages
- Add JSDoc comments for all public APIs
- Ensure your code passes linting (`npm run lint`)
- Format your code with Prettier (`npm run format`)

## Release Process

The maintainers will handle the release process, including:

1. Updating the version in package.json
2. Creating a changelog entry
3. Creating a GitHub release
4. Publishing to the VS Code Marketplace

## Questions?

If you have any questions, feel free to create an issue on GitHub or reach out to the maintainers directly.

Thank you for contributing to Copilot Code Review!
