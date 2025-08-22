# Technology Stack

## Core Technologies

- **Runtime**: Node.js (>=14.0.0)
- **Language**: TypeScript with ES2020 target
- **Module System**: ES Modules (type: "module")
- **Build Tool**: TypeScript Compiler (tsc)

## Key Dependencies

- **@modelcontextprotocol/sdk**: MCP server implementation
- **googleapis**: Google APIs client library
- **google-auth-library**: OAuth2 authentication
- **zod**: Runtime type validation and schema generation
- **nodemailer**: Email composition with attachment support
- **mime-types**: MIME type detection for attachments

## Development Dependencies

- **typescript**: TypeScript compiler
- **@types/node**: Node.js type definitions
- **@types/nodemailer**: Nodemailer type definitions

## Build System

The project uses TypeScript compilation with the following configuration:
- Output directory: `./dist`
- Source directory: `./src`
- Module resolution: Node.js style
- Strict type checking enabled

## Common Commands

```bash
# Build the project
npm run build

# Start the server
npm start

# Run authentication flow
npm run auth

# Development build (triggered by prepare script)
npm run prepare

# Pre-publish build
npm run prepublishOnly

# Run evaluations
OPENAI_API_KEY=your-key npx mcp-eval src/evals/evals.ts src/index.ts
```

## Docker Support

The project includes Docker configuration with:
- Base image: node:20-slim
- Multi-stage build process
- Environment variable configuration for credentials
- Port 3000 exposed for OAuth callback

## Authentication Architecture

- OAuth2 flow with Google APIs
- Credential storage in `~/.gmail-mcp/`
- Support for both Desktop and Web application credentials
- Auto browser launch for authentication
- Global credential sharing across directories