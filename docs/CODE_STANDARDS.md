# Code Standards

This project uses ESLint, Prettier, and Husky to maintain consistent code quality and formatting.

## Tools

- **ESLint**: Linting and code quality checks
- **Prettier**: Code formatting
- **Husky**: Git hooks for pre-commit checks
- **lint-staged**: Run linters on staged files only

## Configuration

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
- **Imports**: Automatically sorted and grouped:
  1. External packages
  2. Internal modules
  3. Relative imports

### ESLint Rules

- TypeScript strict mode enabled
- Unused variables/parameters error (except those prefixed with `_`)
- `any` type usage generates warnings
- Prefer `const` over `let` (enforced)
- No `var` declarations (enforced)
- Import sorting enforced

## Usage

### Format code

```bash
npm run format
```

### Check formatting

```bash
npm run format:check
```

### Lint code

```bash
npm run lint
```

### Fix linting issues

```bash
npm run lint:fix
```

### Type check

```bash
npm run type-check
```

## Pre-commit Hooks

Husky automatically runs lint-staged before each commit:

- **TypeScript/JavaScript files**: ESLint fixes + Prettier formatting
- **JSON/CSS/Markdown files**: Prettier formatting only

Staged files are automatically fixed and formatted before commit. If there are unfixable errors, the commit will be blocked.

## Editor Integration

### VS Code

Install these extensions:

- ESLint
- Prettier

Add to your `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### Other Editors

Most modern editors support ESLint and Prettier. Configure them to:

- Format on save
- Show ESLint errors inline
- Use the project's `.prettierrc.json` and `eslint.config.js` files
