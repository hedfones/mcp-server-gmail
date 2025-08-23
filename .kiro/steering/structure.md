# Project Structure & Organization

## Root Directory

- **Configuration Files**: Package management, TypeScript, Docker, and deployment configs
- **Documentation**: README.md, CORS-CONFIG.md, filter-examples.md, llms-install.md
- **Build Artifacts**: `dist/` (compiled output), `node_modules/` (dependencies)

## Source Code Organization (`src/`)

### Core Files
- **`index.ts`**: Main entry point, server setup, tool handlers, and Gmail API integration
- **`config.ts`**: Environment detection, server configuration, and Railway deployment settings
- **`server-state.ts`**: Server state management and runtime configuration

### Feature Modules
- **`cors-middleware.ts`**: CORS handling for HTTP transport with private network support
- **`http-transport.ts`**: HTTP server implementation for cloud deployments
- **`label-manager.ts`**: Gmail label operations (create, update, delete, list)
- **`filter-manager.ts`**: Gmail filter management with template system
- **`utl.ts`**: Email creation utilities and RFC822 message formatting
- **`network-utils.ts`**: Network configuration and IPv6 support

### Testing (`src/__tests__/`)
- **Integration Tests**: `dual-transport.integration.test.ts`, `http-transport.integration.test.ts`
- **Unit Tests**: `config.test.ts`, `cors-middleware.test.ts`, `network-utils.test.ts`
- **Test Coverage**: Excludes evals, config files, and test files themselves

### Evaluation (`src/evals/`)
- **`evals.ts`**: MCP server evaluation and testing framework integration

## Configuration Structure

### Kiro Configuration (`.kiro/`)
- **Steering Rules**: `.kiro/steering/` - AI assistant guidance documents
- **Specifications**: `.kiro/specs/` - Feature specifications and design documents

### Deployment Configuration
- **Docker**: `Dockerfile` with multi-stage Railway-optimized builds
- **Railway**: `railway.toml` for deployment configuration
- **Compose**: `docker-compose.yml` for local container development

## File Naming Conventions

- **TypeScript Files**: kebab-case (e.g., `cors-middleware.ts`, `label-manager.ts`)
- **Test Files**: `*.test.ts` suffix in `__tests__/` directories
- **Configuration**: Root-level config files use standard names (tsconfig.json, package.json)
- **Documentation**: UPPERCASE.md for important docs, lowercase.md for guides

## Module Dependencies

- **Core Dependencies**: MCP SDK, Google APIs, Zod validation
- **Utility Dependencies**: Nodemailer, mime-types, open (for OAuth)
- **Development Dependencies**: Vitest, TypeScript, type definitions
- **No Circular Dependencies**: Clean separation between feature modules

## Environment-Specific Structure

- **Local Development**: Uses stdio transport, minimal configuration
- **Railway Deployment**: HTTP transport, CORS middleware, environment detection
- **Docker**: Containerized with credential volume mounts and health checks

## Key Architectural Patterns

- **Transport Abstraction**: Dual support for stdio (local) and HTTP (cloud) transports
- **Environment Detection**: Automatic configuration based on deployment context
- **Modular Design**: Feature-specific modules with clear separation of concerns
- **Configuration-Driven**: Environment variables control behavior and deployment modes