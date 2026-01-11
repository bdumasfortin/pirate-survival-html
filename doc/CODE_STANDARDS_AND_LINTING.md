# Code Standards and Linting

This project uses ESLint, Prettier, Husky, and lint-staged to maintain consistent code quality and formatting.

## Tools

- **ESLint**: Linting and code quality checks
- **Prettier**: Code formatting
- **Husky**: Git hooks for pre-commit checks
- **lint-staged**: Run linters on staged files only

## Setup

All dependencies are already installed. Configuration files:

- `.eslintrc.json` - ESLint configuration for client code
- `server/.eslintrc.json` - ESLint configuration for server code
- `.prettierrc.json` - Prettier formatting rules
- `.editorconfig` - Editor configuration
- `.husky/pre-commit` - Pre-commit hook for linting

## Standards

### Formatting Rules

- **Quotes**: Double quotes (`"`)
- **Semicolons**: Required
- **Line length**: 120 characters
- **Trailing commas**: ES5 style (objects, arrays, etc.)
- **Indentation**: 2 spaces
- **Arrow functions**: Preferred over function declarations

### Code Style

- **Variables/Functions**: camelCase
- **Classes/Types**: PascalCase
- **Constants**: Use `const` when possible (enforced by ESLint)
- **Unused variables**: Prefix with `_` to ignore (e.g., `_unusedParam`)
- **Imports**: Automatically sorted and grouped:
  1. Built-in modules (e.g., `node:http`)
  2. External packages (e.g., `ws`)
  3. Internal modules
  4. Parent directories
  5. Sibling files
  6. Index files

Each group is separated by a blank line and sorted alphabetically.

### ESLint Rules

- TypeScript strict mode enabled
- Unused variables/parameters error (except those prefixed with `_`)
- `any` type usage generates warnings
- Prefer `const` over `let` (enforced)
- No `var` declarations (enforced)
- Import sorting enforced

## Commands

### Client (root)

```bash
npm run lint           # Check for linting errors
npm run lint:fix       # Fix auto-fixable linting errors
npm run format         # Format all files with Prettier
npm run format:check   # Check if files are formatted
npm run type-check     # Type check without emitting files
```

### Server

```bash
cd server
npm run lint           # Check for linting errors
npm run lint:fix       # Fix auto-fixable linting errors
npm run format         # Format all files with Prettier
npm run format:check   # Check if files are formatted
npm run type-check     # Type check without emitting files
```

## Pre-commit Hooks

Husky automatically runs lint-staged before each commit:

- **TypeScript/JavaScript files**: ESLint fixes + Prettier formatting
- **JSON/CSS/Markdown files**: Prettier formatting only

Staged files are automatically fixed and formatted before commit. If there are unfixable errors, the commit will be
blocked.

To bypass hooks (not recommended):

```bash
git commit --no-verify
```

## Editor Integration

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

### Other Editors

Most modern editors support ESLint and Prettier. Configure them to:

- Format on save
- Show ESLint errors inline
- Use the project's `.prettierrc.json` and `eslint.config.js` files
