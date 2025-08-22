# Design Document

## Overview

This design modifies the existing Gmail MCP server to support deployment on Railway platform with IPv6 networking and remote accessibility. The solution involves creating Railway-specific configuration files, updating the Dockerfile for Railway compatibility, implementing IPv6 dual-stack networking, and adding CORS support for private network access.

## Architecture

### Current Architecture
- MCP server using StdioServerTransport for local communication
- OAuth2 authentication with local HTTP server for callback
- Local file-based credential storage
- Single-stack IPv4 networking

### Target Architecture
- Dual transport support: StdioServerTransport (local) + HTTP server (remote)
- Railway-optimized Docker container with proper port binding
- IPv6 dual-stack networking capability
- CORS-enabled HTTP endpoints for private network access
- Environment-based configuration for Railway deployment

## Components and Interfaces

### 1. Railway Configuration Component

**railway.toml Configuration**
```toml
[build]
builder = "DOCKERFILE"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
```

**Purpose**: Defines Railway-specific deployment configuration including build process, health checks, and restart policies.

### 2. Enhanced Dockerfile

**Multi-stage Build Process**
- Stage 1: Build environment with TypeScript compilation
- Stage 2: Production runtime with minimal dependencies
- Railway PORT environment variable support
- Optimized layer caching for faster builds

**Key Changes**:
- Use Railway's PORT environment variable
- Optimize for Railway's build environment
- Add health check endpoint
- Support both IPv4 and IPv6 binding

### 3. Dual Transport Server Component

**Interface**: Enhanced server initialization supporting both transports
```typescript
interface ServerConfig {
  mode: 'stdio' | 'http' | 'dual';
  port?: number;
  host?: string;
  corsOrigins?: string[];
  enableIPv6?: boolean;
}
```

**Responsibilities**:
- Detect runtime environment (local vs Railway)
- Initialize appropriate transport(s)
- Handle graceful shutdown
- Provide health check endpoint

### 4. IPv6 Networking Component

**Dual-Stack Implementation**:
- Bind to both `::` (IPv6) and `0.0.0.0` (IPv4) when available
- Fallback to IPv4-only if IPv6 is not supported
- Environment detection for network stack capabilities

**Configuration**:
```typescript
interface NetworkConfig {
  preferIPv6: boolean;
  dualStack: boolean;
  bindAddress: string;
  port: number;
}
```

### 5. CORS Security Component

**CORS Configuration**:
```typescript
interface CORSConfig {
  origins: string[];
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
}
```

**Default Configuration**:
- Allow private network ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Support for Railway's internal networking
- Configurable via environment variables

## Data Models

### Environment Configuration Model
```typescript
interface EnvironmentConfig {
  // Railway-specific
  PORT: number;
  RAILWAY_ENVIRONMENT?: string;
  RAILWAY_SERVICE_NAME?: string;
  
  // Application-specific
  MCP_SERVER_MODE: 'stdio' | 'http' | 'dual';
  CORS_ORIGINS?: string;
  ENABLE_IPV6?: boolean;
  
  // Existing Gmail config
  GMAIL_CREDENTIALS_PATH?: string;
  GMAIL_OAUTH_PATH?: string;
}
```

### Server State Model
```typescript
interface ServerState {
  mode: 'stdio' | 'http' | 'dual';
  transports: {
    stdio?: StdioServerTransport;
    http?: HttpServerTransport;
  };
  networkConfig: NetworkConfig;
  corsConfig: CORSConfig;
  isHealthy: boolean;
}
```

## Error Handling

### Network Binding Errors
- **IPv6 Unavailable**: Gracefully fallback to IPv4-only mode
- **Port Binding Failure**: Retry with Railway-assigned port or fail gracefully
- **Dual-stack Failure**: Log warning and continue with available stack

### CORS Errors
- **Unauthorized Origin**: Return 403 with clear error message
- **Preflight Failure**: Log and return appropriate CORS headers
- **Configuration Error**: Fail fast with descriptive error message

### Railway-specific Errors
- **Build Failure**: Clear error messages for missing dependencies or build issues
- **Health Check Failure**: Return 503 with service status information
- **Environment Variable Missing**: Provide defaults or clear error messages

## Testing Strategy

### Unit Tests
- Network configuration validation
- CORS header generation
- Environment variable parsing
- Transport initialization logic

### Integration Tests
- Dual-stack network binding
- CORS policy enforcement
- Health check endpoint functionality
- Railway environment simulation

### Deployment Tests
- Railway build process validation
- Container startup verification
- Network connectivity testing (IPv4/IPv6)
- Health check endpoint accessibility

### Performance Tests
- Concurrent connection handling
- Memory usage in Railway environment
- Response time benchmarks
- Resource utilization monitoring

## Implementation Phases

### Phase 1: Railway Configuration
- Create railway.toml configuration file
- Update Dockerfile for Railway compatibility
- Add health check endpoint
- Environment variable configuration

### Phase 2: Network Enhancement
- Implement IPv6 dual-stack support
- Add HTTP transport alongside stdio
- Network configuration detection
- Graceful fallback mechanisms

### Phase 3: Security & CORS
- Implement CORS middleware
- Private network origin validation
- Security header configuration
- Request validation

### Phase 4: Testing & Validation
- Comprehensive test suite
- Railway deployment testing
- Performance validation
- Documentation updates