# Code Standards & Linting

This project uses ESLint, Prettier, and Husky to maintain code quality and consistency.

## Setup

All dependencies are already installed. The configuration files are:

- `.eslintrc.json` - ESLint configuration for client code
- `server/.eslintrc.json` - ESLint configuration for server code
- `.prettierrc.json` - Prettier formatting rules
- `.editorconfig` - Editor configuration
- `.husky/pre-commit` - Pre-commit hook for linting

## Code Standards

### Formatting

- **Quotes**: Double quotes (`"`)
- **Semicolons**: Required
- **Line length**: 120 characters
- **Trailing commas**: Yes (ES5 style)
- **Indentation**: 2 spaces

### Code Style

- **Variables/Functions**: camelCase
- **Classes/Types**: PascalCase
- **Prefer**: `const` over `let`, arrow functions over function declarations
- **Unused variables**: Prefix with `_` to ignore (e.g., `_unusedParam`)

### Import Organization

Imports are automatically sorted and grouped:

1. Built-in modules (e.g., `node:http`)
2. External packages (e.g., `ws`)
3. Internal modules
4. Parent directories
5. Sibling files
6. Index files

Each group is separated by a blank line and sorted alphabetically.

## Commands

### Client (root)

```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Fix auto-fixable linting errors
npm run format        # Format all files with Prettier
npm run format:check   # Check if files are formatted
npm run type-check    # Type check without emitting files
```

### Server

```bash
cd server
npm run lint          # Check for linting errors
npm run lint:fix      # Fix auto-fixable linting errors
npm run format        # Format all files with Prettier
npm run format:check  # Check if files are formatted
npm run type-check    # Type check without emitting files
```

## Pre-commit Hooks

Husky automatically runs lint-staged before each commit:

- Lints and fixes TypeScript/JavaScript files
- Formats JSON, CSS, and Markdown files

To bypass hooks (not recommended):

```bash
git commit --no-verify
```

## IDE Integration

### VS Code

Install these extensions:

- ESLint
- Prettier - Code formatter

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"]
}
```

### Other IDEs

Most modern IDEs support ESLint and Prettier. Check your IDE's documentation for setup instructions.
