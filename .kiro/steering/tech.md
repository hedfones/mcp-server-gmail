# Technology Stack & Build System

## Core Technologies

- **Runtime**: Node.js 20+ (ES2020 modules)
- **Language**: TypeScript with strict mode disabled
- **Package Manager**: npm with package-lock.json
- **Module System**: ES modules (`"type": "module"` in package.json)

## Key Dependencies

- **MCP SDK**: `@modelcontextprotocol/sdk` for Model Context Protocol implementation
- **Google APIs**: `googleapis` and `google-auth-library` for Gmail integration
- **Validation**: `zod` with `zod-to-json-schema` for runtime type validation
- **Email Processing**: `nodemailer` for RFC822 compliant email creation
- **File Types**: `mime-types` for attachment handling
- **CLI**: `open` for browser automation during OAuth

## Development Tools

- **Testing**: Vitest with coverage support (`vitest`, `@vitest/ui`)
- **Build**: TypeScript compiler (`tsc`)
- **Evaluation**: `mcp-eval` for MCP server testing

## Build Commands

```bash
# Development
npm run build          # Compile TypeScript to dist/
npm run test           # Run test suite
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report

# Production
npm run start          # Run compiled server
npm run prepare        # Pre-publish build step

# Authentication
npm run auth           # Run OAuth authentication flow

# Health Checks
npm run health         # Local health check
npm run health:railway # Railway deployment health check
```

## Project Structure

- **Source**: `src/` - TypeScript source files
- **Output**: `dist/` - Compiled JavaScript (ES modules)
- **Tests**: `src/__tests__/` - Vitest test files
- **Config**: Root level config files (tsconfig.json, vitest.config.ts)

## Environment Support

- **Local Development**: stdio transport mode
- **Cloud Deployment**: HTTP transport with CORS middleware
- **Docker**: Multi-stage builds with Railway optimization
- **Railway**: Automatic environment detection and configuration

## TypeScript Configuration

- Target: ES2020 with Node.js module resolution
- Strict mode disabled for flexibility
- ESM interop enabled
- Source maps and declaration files excluded from build