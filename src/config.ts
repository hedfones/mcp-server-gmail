/**
 * Server configuration interfaces and environment detection for Railway deployment
 */

export interface ServerConfig {
  mode: 'stdio' | 'http' | 'dual';
  port?: number;
  host?: string;
  corsOrigins?: string[];
  enableIPv6?: boolean;
  allowPrivateNetworkAccess?: boolean;
  railwayInternalAccess?: boolean;
}

export interface NetworkConfig {
  preferIPv6: boolean;
  dualStack: boolean;
  bindAddress: string;
  port: number;
  ipv6Only?: boolean;
}

export interface EnvironmentConfig {
  // Railway-specific
  PORT?: number;
  RAILWAY_ENVIRONMENT?: string;
  RAILWAY_SERVICE_NAME?: string;
  
  // Application-specific
  MCP_SERVER_MODE?: 'stdio' | 'http' | 'dual';
  CORS_ORIGINS?: string;
  ENABLE_IPV6?: boolean;
  IPV6_DUAL_STACK?: boolean;
  IPV6_PREFER?: boolean;
  ALLOW_PRIVATE_NETWORK_ACCESS?: boolean;
  RAILWAY_INTERNAL_ACCESS?: boolean;
  
  // Existing Gmail config
  GMAIL_CREDENTIALS_PATH?: string;
  GMAIL_OAUTH_PATH?: string;
}

/**
 * Detects the runtime environment and determines the appropriate server mode
 */
export function detectEnvironment(): 'local' | 'railway' {
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
export function parseServerConfig(): ServerConfig {
  const environment = detectEnvironment();
  
  // Default configuration based on environment
  const defaultConfig: ServerConfig = {
    mode: environment === 'railway' ? 'http' : 'stdio',
    port: environment === 'railway' ? parseInt(process.env.PORT || '3000', 10) : 3000,
    host: environment === 'railway' ? '0.0.0.0' : 'localhost',
    corsOrigins: [],
    enableIPv6: environment === 'railway' ? true : false,
    allowPrivateNetworkAccess: environment === 'railway' ? true : false,
    railwayInternalAccess: environment === 'railway' ? true : false,
  };
  
  // Override with explicit environment variables if provided
  const config: ServerConfig = {
    mode: (process.env.MCP_SERVER_MODE as 'stdio' | 'http' | 'dual') || defaultConfig.mode,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : defaultConfig.port,
    host: defaultConfig.host,
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : defaultConfig.corsOrigins,
    enableIPv6: process.env.ENABLE_IPV6 ? process.env.ENABLE_IPV6.toLowerCase() === 'true' : defaultConfig.enableIPv6,
    allowPrivateNetworkAccess: process.env.ALLOW_PRIVATE_NETWORK_ACCESS ? process.env.ALLOW_PRIVATE_NETWORK_ACCESS.toLowerCase() === 'true' : defaultConfig.allowPrivateNetworkAccess,
    railwayInternalAccess: process.env.RAILWAY_INTERNAL_ACCESS ? process.env.RAILWAY_INTERNAL_ACCESS.toLowerCase() === 'true' : defaultConfig.railwayInternalAccess,
  };
  
  return config;
}

/**
 * Creates network configuration based on server config and environment
 */
export function createNetworkConfig(serverConfig: ServerConfig): NetworkConfig {
  const environment = detectEnvironment();
  const envConfig = getEnvironmentConfig();
  
  // Determine IPv6 preferences from environment or config
  const enableIPv6 = serverConfig.enableIPv6 || false;
  const preferIPv6 = envConfig.IPV6_PREFER !== undefined 
    ? envConfig.IPV6_PREFER 
    : (environment === 'railway' ? true : false);
  const dualStack = envConfig.IPV6_DUAL_STACK !== undefined 
    ? envConfig.IPV6_DUAL_STACK 
    : (environment === 'railway' ? true : enableIPv6);
  
  return {
    preferIPv6,
    dualStack,
    bindAddress: preferIPv6 ? '::' : (serverConfig.host || '0.0.0.0'),
    port: serverConfig.port || 3000,
    ipv6Only: false, // We want dual-stack by default
  };
}

/**
 * Validates the server configuration and throws errors for invalid settings
 */
export function validateServerConfig(config: ServerConfig): void {
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
export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
    RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME,
    MCP_SERVER_MODE: process.env.MCP_SERVER_MODE as 'stdio' | 'http' | 'dual' | undefined,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    ENABLE_IPV6: process.env.ENABLE_IPV6 ? process.env.ENABLE_IPV6.toLowerCase() === 'true' : undefined,
    IPV6_DUAL_STACK: process.env.IPV6_DUAL_STACK ? process.env.IPV6_DUAL_STACK.toLowerCase() === 'true' : undefined,
    IPV6_PREFER: process.env.IPV6_PREFER ? process.env.IPV6_PREFER.toLowerCase() === 'true' : undefined,
    ALLOW_PRIVATE_NETWORK_ACCESS: process.env.ALLOW_PRIVATE_NETWORK_ACCESS ? process.env.ALLOW_PRIVATE_NETWORK_ACCESS.toLowerCase() === 'true' : undefined,
    RAILWAY_INTERNAL_ACCESS: process.env.RAILWAY_INTERNAL_ACCESS ? process.env.RAILWAY_INTERNAL_ACCESS.toLowerCase() === 'true' : undefined,
    GMAIL_CREDENTIALS_PATH: process.env.GMAIL_CREDENTIALS_PATH,
    GMAIL_OAUTH_PATH: process.env.GMAIL_OAUTH_PATH,
  };
}

/**
 * Generates private network CORS origins based on configuration
 */
export function generatePrivateNetworkOrigins(config: ServerConfig): string[] {
  const origins: string[] = [];

  if (config.allowPrivateNetworkAccess) {
    // Add private network ranges (RFC 1918)
    origins.push(
      // 10.0.0.0/8
      'http://10.*',
      'https://10.*',
      // 172.16.0.0/12
      'http://172.16.*',
      'https://172.16.*',
      'http://172.17.*',
      'https://172.17.*',
      'http://172.18.*',
      'https://172.18.*',
      'http://172.19.*',
      'https://172.19.*',
      'http://172.20.*',
      'https://172.20.*',
      'http://172.21.*',
      'https://172.21.*',
      'http://172.22.*',
      'https://172.22.*',
      'http://172.23.*',
      'https://172.23.*',
      'http://172.24.*',
      'https://172.24.*',
      'http://172.25.*',
      'https://172.25.*',
      'http://172.26.*',
      'https://172.26.*',
      'http://172.27.*',
      'https://172.27.*',
      'http://172.28.*',
      'https://172.28.*',
      'http://172.29.*',
      'https://172.29.*',
      'http://172.30.*',
      'https://172.30.*',
      'http://172.31.*',
      'https://172.31.*',
      // 192.168.0.0/16
      'http://192.168.*',
      'https://192.168.*',
      // Localhost and loopback
      'http://localhost:*',
      'https://localhost:*',
      'http://127.0.0.1:*',
      'https://127.0.0.1:*',
      // IPv6 localhost
      'http://[::1]:*',
      'https://[::1]:*'
    );
  }

  if (config.railwayInternalAccess) {
    // Add Railway internal network patterns
    origins.push(
      'https://*.railway.app',
      'https://*.up.railway.app',
      'http://*.railway.internal',
      'https://*.railway.internal'
    );
  }

  return origins;
}

/**
 * Merges configured CORS origins with generated private network origins
 */
export function getMergedCORSOrigins(config: ServerConfig): string[] {
  const configuredOrigins = config.corsOrigins || [];
  const privateNetworkOrigins = generatePrivateNetworkOrigins(config);
  
  // Combine and deduplicate origins
  const allOrigins = [...configuredOrigins, ...privateNetworkOrigins];
  return [...new Set(allOrigins)];
}