# Rigorous Check System

This project now includes a comprehensive `pnpm run check` command that performs thorough validation of your codebase.

## What It Checks

The `check` script runs **7 separate validation steps** in sequence:

### 1. **Type Checking** (`check:types`)
- Runs TypeScript with strict mode enabled
- Additional flags: `--noUnusedLocals`, `--noUnusedParameters`, `--noImplicitReturns`
- Catches all type errors, unused code, and implicit returns

### 2. **Linting** (`check:lint`)
- Runs ESLint with TypeScript support
- Zero warnings allowed (`--max-warnings 0`)
- Enforces code quality and best practices

### 3. **Security** (`check:security`)
- Runs ESLint with security-specific rules
- Detects potential security vulnerabilities
- Checks for unsafe regex, object injection, non-literal regexp, etc.

### 4. **Dependency Audit** (`check:deps`)
- Runs `pnpm audit --audit-level high`
- Identifies known security vulnerabilities in dependencies
- Fails if high-severity issues found

### 5. **Code Formatting** (`check:format`)
- Runs Prettier in check mode
- Ensures consistent code style across the project
- All files must be properly formatted

### 6. **Build** (`check:build`)
- Cleans and rebuilds the entire project
- Ensures the project compiles successfully
- Verifies no build errors

### 7. **Tests** (`check:test`)
- Runs the full test suite
- Ensures all tests pass
- Validates functionality

## Usage

### Run All Checks
```bash
pnpm run check
```

### Run Individual Checks
```bash
pnpm run check:types    # Type checking only
pnpm run check:lint     # Linting only
pnpm run check:security # Security checks only
pnpm run check:deps     # Dependency audit only
pnpm run check:format   # Format checking only
pnpm run check:build    # Build only
pnpm run check:test     # Tests only
```

### Auto-format Code
```bash
pnpm run format
```

## Configuration Files

### ESLint (`.eslintrc.json`)
- TypeScript ESLint plugin with strict type-checking rules
- Security plugin for vulnerability detection
- Prettier integration for formatting
- Zero warnings policy

### Prettier (`.prettierrc`)
- Consistent code formatting
- 2-space indentation
- Single quotes
- 100 character line width
- LF line endings

### TypeScript (`tsconfig.json`)
- Strict mode enabled
- All strict type-checking options
- ES2022 target
- Module resolution

## CI/CD Integration

This check system is perfect for CI/CD pipelines. Add this to your workflow:

```yaml
- name: Run Comprehensive Checks
  run: pnpm run check
```

## Fixing Issues

### Type Errors
Fix the reported TypeScript errors in the source files. The checker uses strict mode.

### Linting Issues
Run ESLint with auto-fix:
```bash
pnpm run format  # Prettier will fix many issues
```

### Security Issues
Address security vulnerabilities found by the audit or ESLint security rules.

### Formatting Issues
Run the format command:
```bash
pnpm run format
```

## Exit Codes

The check script uses proper exit codes:
- **0**: All checks passed
- **1**: One or more checks failed

This makes it ideal for pre-commit hooks and CI/CD pipelines.

## Pre-commit Hook

Consider adding to your Git workflow:

```bash
# .git/hooks/pre-commit
#!/bin/bash
pnpm run check
```

## Benefits

1. **Catches bugs early** - Strict type checking finds issues at compile time
2. **Security first** - Dedicated security linting and dependency auditing
3. **Code quality** - Consistent formatting and linting standards
4. **Zero warnings** - No technical debt accumulation
5. **CI/CD ready** - Fails fast with proper exit codes
6. **Comprehensive** - Covers types, linting, security, formatting, build, and tests
