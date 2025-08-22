/**
 * Server configuration interfaces and environment detection for Railway deployment
 */

/**
 * Detects the runtime environment and determines the appropriate server mode
 */
export function detectEnvironment() {
  // Check for Railway-specific environment variables
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME) {
    return 'railway';
  }
  
  // Check for Railway PORT environment variable (Railway sets this automatically)
  if (process.env.PORT && !process.env.NODE_ENV) {
    return 'railway';
  }
  
  return 'local';
}

/**
 * Parses environment variables and creates server configuration
 */
export function parseServerConfig() {
  const environment = detectEnvironment();
  
  // Default configuration based on environment
  const defaultConfig = {
    mode: environment === 'railway' ? 'http' : 'stdio',
    port: environment === 'railway' ? parseInt(process.env.PORT || '3000', 10) : 3000,
    host: environment === 'railway' ? '0.0.0.0' : 'localhost',
    corsOrigins: [],
    enableIPv6: environment === 'railway' ? true : false,
  };
  
  // Override with explicit environment variables if provided
  const config = {
    mode: process.env.MCP_SERVER_MODE || defaultConfig.mode,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : defaultConfig.port,
    host: defaultConfig.host,
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : defaultConfig.corsOrigins,
    enableIPv6: process.env.ENABLE_IPV6 ? process.env.ENABLE_IPV6.toLowerCase() === 'true' : defaultConfig.enableIPv6,
  };
  
  return config;
}

/**
 * Creates network configuration based on server config and environment
 */
export function createNetworkConfig(serverConfig) {
  const environment = detectEnvironment();
  
  return {
    preferIPv6: serverConfig.enableIPv6 || false,
    dualStack: serverConfig.enableIPv6 || false,
    bindAddress: serverConfig.enableIPv6 ? '::' : (serverConfig.host || '0.0.0.0'),
    port: serverConfig.port || 3000,
  };
}

/**
 * Validates the server configuration and throws errors for invalid settings
 */
export function validateServerConfig(config) {
  if (!config.mode || !['stdio', 'http', 'dual'].includes(config.mode)) {
    throw new Error(`Invalid server mode: ${config.mode}. Must be 'stdio', 'http', or 'dual'`);
  }
  
  if (config.mode !== 'stdio' && (!config.port || config.port < 1 || config.port > 65535)) {
    throw new Error(`Invalid port: ${config.port}. Must be between 1 and 65535`);
  }
  
  if (config.corsOrigins && !Array.isArray(config.corsOrigins)) {
    throw new Error('CORS origins must be an array of strings');
  }
}

/**
 * Gets the current environment configuration from process.env
 */
export function getEnvironmentConfig() {
  return {
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
    RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME,
    MCP_SERVER_MODE: process.env.MCP_SERVER_MODE,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    ENABLE_IPV6: process.env.ENABLE_IPV6 ? process.env.ENABLE_IPV6.toLowerCase() === 'true' : undefined,
    GMAIL_CREDENTIALS_PATH: process.env.GMAIL_CREDENTIALS_PATH,
    GMAIL_OAUTH_PATH: process.env.GMAIL_OAUTH_PATH,
  };
}