# Implementation Plan

- [x] 1. Create Railway configuration files
  - Create railway.toml with build and deploy configuration for Railway platform
  - Configure health check endpoint, restart policy, and build settings
  - _Requirements: 1.4, 4.1, 4.4, 4.5_

- [ ] 2. Update Dockerfile for Railway compatibility
  - Modify Dockerfile to use Railway's PORT environment variable
  - Optimize Docker build process with multi-stage build for Railway
  - Add support for Railway-specific environment variables and caching
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2_

- [ ] 3. Implement dual transport server architecture
- [ ] 3.1 Create server configuration interface and environment detection
  - Define TypeScript interfaces for ServerConfig and NetworkConfig
  - Implement environment detection logic to determine runtime mode (local vs Railway)
  - Create configuration parsing from environment variables
  - _Requirements: 1.1, 3.1, 4.3_

- [ ] 3.2 Implement HTTP transport alongside existing stdio transport
  - Create HTTP server transport class that wraps MCP server functionality
  - Add HTTP endpoint handlers for MCP protocol over HTTP
  - Implement request/response mapping between HTTP and MCP protocols
  - _Requirements: 3.1, 3.4_

- [ ] 3.3 Add health check endpoint for Railway monitoring
  - Implement /health endpoint that returns server status and connectivity
  - Add basic service health validation (Gmail API connectivity, credential status)
  - Return appropriate HTTP status codes and JSON response format
  - _Requirements: 4.5_

- [ ] 4. Implement IPv6 dual-stack networking support
- [ ] 4.1 Add IPv6 network binding capability
  - Modify server initialization to bind to both IPv6 (::) and IPv4 (0.0.0.0) addresses
  - Implement network stack detection to determine available protocols
  - Add configuration options for IPv6 preference and dual-stack mode
  - _Requirements: 2.1, 2.3_

- [ ] 4.2 Implement graceful fallback for IPv6 unavailable scenarios
  - Add error handling for IPv6 binding failures
  - Implement automatic fallback to IPv4-only mode when IPv6 is unavailable
  - Log network configuration decisions for debugging
  - _Requirements: 2.2, 2.4_

- [ ] 5. Add CORS support for private network access
- [ ] 5.1 Implement CORS middleware for HTTP transport
  - Create CORS middleware that validates origins against private network ranges
  - Add support for preflight OPTIONS requests with appropriate headers
  - Implement configurable CORS origins via environment variables
  - _Requirements: 5.1, 5.2, 5.4_

- [ ] 5.2 Configure private network origin validation
  - Define default allowed origins for private network ranges (10.x, 172.16-31.x, 192.168.x)
  - Add Railway internal network support for service-to-service communication
  - Implement origin validation logic with proper error responses
  - _Requirements: 5.3_

- [ ] 6. Update server initialization and startup logic
- [ ] 6.1 Modify main server entry point for dual transport support
  - Update main() function to initialize both stdio and HTTP transports based on environment
  - Add graceful shutdown handling for both transport types
  - Implement proper error handling and logging for startup failures
  - _Requirements: 1.1, 3.1, 3.4_

- [ ] 6.2 Add environment-based configuration loading
  - Implement configuration loading from Railway environment variables
  - Add validation for required environment variables with clear error messages
  - Create default configuration values for local development mode
  - _Requirements: 4.3, 4.4_

- [ ] 7. Create comprehensive test suite for new functionality
- [ ] 7.1 Write unit tests for network configuration and CORS
  - Test IPv6/IPv4 network configuration detection and binding
  - Test CORS header generation and origin validation logic
  - Test environment variable parsing and configuration validation
  - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 5.3_

- [ ] 7.2 Write integration tests for dual transport functionality
  - Test HTTP transport MCP protocol handling with sample requests
  - Test health check endpoint functionality and response format
  - Test concurrent connection handling for both stdio and HTTP transports
  - _Requirements: 3.1, 3.4, 4.5_

- [ ] 8. Update package.json scripts for Railway deployment
  - Add Railway-specific build and start scripts
  - Update existing scripts to support both local and Railway environments
  - Add health check script for Railway monitoring
  - _Requirements: 1.1, 4.4_