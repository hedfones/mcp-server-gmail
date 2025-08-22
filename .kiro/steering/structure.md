# Project Structure

## Root Directory

- **src/**: Source code directory
- **dist/**: Compiled TypeScript output (generated)
- **package.json**: Project configuration and dependencies
- **tsconfig.json**: TypeScript compiler configuration
- **Dockerfile**: Container configuration
- **docker-compose.yml**: Docker orchestration
- **mcp-config.json**: Local MCP server configuration
- **smithery.yaml**: Smithery deployment configuration

## Source Code Organization (`src/`)

### Core Files

- **index.ts**: Main server entry point and tool handlers
  - MCP server setup and configuration
  - OAuth2 authentication flow
  - All tool implementations (send_email, read_email, etc.)
  - Schema definitions using Zod
  - Gmail API integration

### Specialized Modules

- **label-manager.ts**: Gmail label operations
  - Create, update, delete labels
  - Label visibility management
  - Label search and organization utilities

- **filter-manager.ts**: Gmail filter operations
  - Filter creation with custom criteria
  - Pre-built filter templates
  - Filter management (list, get, delete)

- **utl.ts**: Utility functions
  - Email message composition
  - MIME type handling
  - Email validation
  - Nodemailer integration for attachments

### Evaluation System (`src/evals/`)

- **evals.ts**: Test suite for MCP tools
  - Automated evaluation functions
  - Integration with mcp-evals package
  - Tool-specific test scenarios

## Architecture Patterns

### Modular Design
- Separation of concerns with dedicated managers
- Utility functions isolated in separate module
- Clear boundaries between authentication, email operations, and management features

### Schema-First Approach
- Zod schemas define tool interfaces
- Runtime validation of all inputs
- Automatic JSON schema generation for MCP

### Error Handling
- Graceful error handling with descriptive messages
- Proper HTTP status code interpretation
- User-friendly error responses

### Configuration Management
- Environment variable support
- Global credential storage
- Flexible authentication paths