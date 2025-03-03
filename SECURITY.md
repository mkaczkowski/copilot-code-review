# Security Policy

## Supported Versions

We currently support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| < 0.3.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an email to the project maintainer. All security vulnerabilities will be promptly addressed.

Please include the following information in your report:

- Type of vulnerability
- Full path of the affected file(s)
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

## Security Considerations

This extension interacts with your code and sends portions of it to GitHub Copilot for analysis. Please be aware of the following:

1. **Code Privacy**: Code snippets are sent to GitHub Copilot for analysis. Do not use this extension with sensitive or proprietary code if you have concerns about sharing that code with GitHub's services.

2. **API Tokens**: The extension uses your existing GitHub Copilot authentication. Never share your authentication tokens or credentials.

3. **Dependencies**: We regularly update dependencies to patch security vulnerabilities. You should always use the latest version of this extension.

## Security Best Practices

When using this extension:

1. Keep VS Code and all extensions updated to the latest versions
2. Review code before accepting any suggestions
3. Be cautious when reviewing code in repositories containing sensitive information
