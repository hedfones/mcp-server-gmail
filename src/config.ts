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
 * Validates required environment variables for Railway deployment
 */
export function validateEnvironmentVariables(): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const environment = detectEnvironment();
  
  // Check Railway-specific requirements
  if (environment === 'railway') {
    // PORT is automatically set by Railway, but validate it exists
    if (!process.env.PORT) {
      errors.push('PORT environment variable is required for Railway deployment');
    } else {
      const port = parseInt(process.env.PORT, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push(`Invalid PORT value: ${process.env.PORT}. Must be a number between 1 and 65535`);
      }
    }
    
    // Warn about missing optional Railway variables
    if (!process.env.RAILWAY_ENVIRONMENT) {
      warnings.push('RAILWAY_ENVIRONMENT not set - this may indicate the app is not running on Railway');
    }
    
    if (!process.env.RAILWAY_SERVICE_NAME) {
      warnings.push('RAILWAY_SERVICE_NAME not set - service identification may be limited');
    }
  }
  
  // Check Gmail-specific requirements
  const gmailCredentialsPath = process.env.GMAIL_CREDENTIALS_PATH;
  const gmailOAuthPath = process.env.GMAIL_OAUTH_PATH;
  
  // These are optional but warn if not set
  if (!gmailCredentialsPath && !gmailOAuthPath) {
    warnings.push('Gmail credential paths not specified - using default locations in ~/.gmail-mcp/');
  }
  
  // Validate CORS origins format if provided
  if (process.env.CORS_ORIGINS) {
    const origins = process.env.CORS_ORIGINS.split(',').map(s => s.trim());
    const invalidOrigins = origins.filter(origin => {
      // Basic validation for origin format
      return !origin || (!origin.startsWith('http://') && !origin.startsWith('https://') && !origin.includes('*'));
    });
    
    if (invalidOrigins.length > 0) {
      errors.push(`Invalid CORS origins detected: ${invalidOrigins.join(', ')}. Origins must start with http:// or https:// or contain wildcards`);
    }
  }
  
  // Validate boolean environment variables
  const booleanVars = [
    'ENABLE_IPV6',
    'IPV6_DUAL_STACK', 
    'IPV6_PREFER',
    'ALLOW_PRIVATE_NETWORK_ACCESS',
    'RAILWAY_INTERNAL_ACCESS'
  ];
  
  for (const varName of booleanVars) {
    const value = process.env[varName];
    if (value && !['true', 'false'].includes(value.toLowerCase())) {
      errors.push(`Invalid boolean value for ${varName}: ${value}. Must be 'true' or 'false'`);
    }
  }
  
  // Validate server mode if explicitly set
  if (process.env.MCP_SERVER_MODE) {
    const mode = process.env.MCP_SERVER_MODE;
    if (!['stdio', 'http', 'dual'].includes(mode)) {
      errors.push(`Invalid MCP_SERVER_MODE: ${mode}. Must be 'stdio', 'http', or 'dual'`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
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

/**
 * Provides configuration guidance and default values for local development
 */
export function getConfigurationGuidance(): {
  localDefaults: Record<string, string>;
  railwayDefaults: Record<string, string>;
  requiredForRailway: string[];
  optionalForRailway: string[];
  examples: Record<string, string>;
} {
  return {
    localDefaults: {
      MCP_SERVER_MODE: 'stdio',
      ENABLE_IPV6: 'false',
      ALLOW_PRIVATE_NETWORK_ACCESS: 'false',
      RAILWAY_INTERNAL_ACCESS: 'false'
    },
    railwayDefaults: {
      MCP_SERVER_MODE: 'http',
      ENABLE_IPV6: 'true',
      IPV6_DUAL_STACK: 'true',
      IPV6_PREFER: 'true',
      ALLOW_PRIVATE_NETWORK_ACCESS: 'true',
      RAILWAY_INTERNAL_ACCESS: 'true'
    },
    requiredForRailway: [
      'PORT' // Automatically set by Railway
    ],
    optionalForRailway: [
      'MCP_SERVER_MODE',
      'CORS_ORIGINS',
      'ENABLE_IPV6',
      'IPV6_DUAL_STACK',
      'IPV6_PREFER',
      'ALLOW_PRIVATE_NETWORK_ACCESS',
      'RAILWAY_INTERNAL_ACCESS',
      'GMAIL_CREDENTIALS_PATH',
      'GMAIL_OAUTH_PATH'
    ],
    examples: {
      CORS_ORIGINS: 'https://myapp.example.com,http://localhost:3000,https://*.railway.app',
      MCP_SERVER_MODE: 'dual',
      ENABLE_IPV6: 'true',
      GMAIL_CREDENTIALS_PATH: '/app/credentials/gmail-credentials.json',
      GMAIL_OAUTH_PATH: '/app/credentials/gcp-oauth.keys.json'
    }
  };
}

/**
 * Logs configuration information for debugging and setup guidance
 */
export function logConfigurationInfo(config: ServerConfig): void {
  const environment = detectEnvironment();
  const envValidation = validateEnvironmentVariables();
  
  console.log('\n=== Server Configuration ===');
  console.log(`Environment: ${environment}`);
  console.log(`Mode: ${config.mode}`);
  console.log(`Port: ${config.port}`);
  console.log(`Host: ${config.host}`);
  console.log(`IPv6 Enabled: ${config.enableIPv6}`);
  console.log(`Private Network Access: ${config.allowPrivateNetworkAccess}`);
  console.log(`Railway Internal Access: ${config.railwayInternalAccess}`);
  console.log(`CORS Origins: ${config.corsOrigins?.length || 0} configured`);
  
  // Log warnings
  if (envValidation.warnings.length > 0) {
    console.log('\n=== Configuration Warnings ===');
    envValidation.warnings.forEach(warning => console.warn(`⚠️  ${warning}`));
  }
  
  // Log configuration guidance for local development
  if (environment === 'local') {
    console.log('\n=== Local Development Setup ===');
    console.log('For Railway deployment, consider setting these environment variables:');
    const guidance = getConfigurationGuidance();
    Object.entries(guidance.railwayDefaults).forEach(([key, value]) => {
      console.log(`  ${key}=${value}`);
    });
  }
  
  console.log('================================\n');
}

/**
 * Enhanced configuration parsing with validation and error handling
 */
export function parseAndValidateServerConfig(): ServerConfig {
  // First validate environment variables
  const envValidation = validateEnvironmentVariables();
  
  if (!envValidation.isValid) {
    console.error('\n=== Configuration Errors ===');
    envValidation.errors.forEach(error => console.error(`❌ ${error}`));
    console.error('================================\n');
    
    const guidance = getConfigurationGuidance();
    console.error('Configuration guidance:');
    console.error('Required for Railway:', guidance.requiredForRailway.join(', '));
    console.error('Optional variables:', guidance.optionalForRailway.join(', '));
    console.error('\nExample values:');
    Object.entries(guidance.examples).forEach(([key, value]) => {
      console.error(`  ${key}=${value}`);
    });
    
    throw new Error(`Configuration validation failed with ${envValidation.errors.length} error(s)`);
  }
  
  // Parse configuration
  const config = parseServerConfig();
  
  // Validate parsed configuration
  validateServerConfig(config);
  
  // Log configuration info
  logConfigurationInfo(config);
  
  return config;
}