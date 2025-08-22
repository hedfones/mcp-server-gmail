/**
 * Unit tests for environment variable parsing and configuration validation
 * Tests Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 5.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectEnvironment,
  parseServerConfig,
  createNetworkConfig,
  validateEnvironmentVariables,
  validateServerConfig,
  getEnvironmentConfig,
  generatePrivateNetworkOrigins,
  getMergedCORSOrigins,
  getConfigurationGuidance,
  parseAndValidateServerConfig,
  ServerConfig,
  NetworkConfig,
  EnvironmentConfig
} from '../config.js';

describe('Configuration Management', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear environment variables that might affect tests
    delete process.env.PORT;
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_SERVICE_NAME;
    delete process.env.MCP_SERVER_MODE;
    delete process.env.CORS_ORIGINS;
    delete process.env.ENABLE_IPV6;
    delete process.env.IPV6_DUAL_STACK;
    delete process.env.IPV6_PREFER;
    delete process.env.ALLOW_PRIVATE_NETWORK_ACCESS;
    delete process.env.RAILWAY_INTERNAL_ACCESS;
    delete process.env.GMAIL_CREDENTIALS_PATH;
    delete process.env.GMAIL_OAUTH_PATH;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('detectEnvironment', () => {
    it('should detect Railway environment when RAILWAY_ENVIRONMENT is set', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      
      const environment = detectEnvironment();
      
      expect(environment).toBe('railway');
    });

    it('should detect Railway environment when RAILWAY_SERVICE_NAME is set', () => {
      process.env.RAILWAY_SERVICE_NAME = 'gmail-mcp-server';
      
      const environment = detectEnvironment();
      
      expect(environment).toBe('railway');
    });

    it('should detect Railway environment when PORT is set without NODE_ENV', () => {
      process.env.PORT = '3000';
      
      const environment = detectEnvironment();
      
      expect(environment).toBe('railway');
    });

    it('should detect local environment when no Railway indicators are present', () => {
      const environment = detectEnvironment();
      
      expect(environment).toBe('local');
    });

    it('should detect local environment when PORT is set with NODE_ENV', () => {
      process.env.PORT = '3000';
      process.env.NODE_ENV = 'development';
      
      const environment = detectEnvironment();
      
      expect(environment).toBe('local');
    });
  });

  describe('parseServerConfig', () => {
    it('should create default local configuration', () => {
      const config = parseServerConfig();
      
      expect(config.mode).toBe('stdio');
      expect(config.port).toBe(3000);
      expect(config.host).toBe('localhost');
      expect(config.enableIPv6).toBe(false);
      expect(config.allowPrivateNetworkAccess).toBe(false);
      expect(config.railwayInternalAccess).toBe(false);
    });

    it('should create default Railway configuration', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      process.env.PORT = '8080';
      
      const config = parseServerConfig();
      
      expect(config.mode).toBe('http');
      expect(config.port).toBe(8080);
      expect(config.host).toBe('0.0.0.0');
      expect(config.enableIPv6).toBe(true);
      expect(config.allowPrivateNetworkAccess).toBe(true);
      expect(config.railwayInternalAccess).toBe(true);
    });

    it('should override defaults with explicit environment variables', () => {
      process.env.MCP_SERVER_MODE = 'dual';
      process.env.PORT = '5000';
      process.env.CORS_ORIGINS = 'https://app1.com,https://app2.com';
      process.env.ENABLE_IPV6 = 'true';
      process.env.ALLOW_PRIVATE_NETWORK_ACCESS = 'false';
      
      const config = parseServerConfig();
      
      expect(config.mode).toBe('dual');
      expect(config.port).toBe(5000);
      expect(config.corsOrigins).toEqual(['https://app1.com', 'https://app2.com']);
      expect(config.enableIPv6).toBe(true);
      expect(config.allowPrivateNetworkAccess).toBe(false);
    });

    it('should handle CORS_ORIGINS with whitespace', () => {
      process.env.CORS_ORIGINS = ' https://app1.com , https://app2.com , https://app3.com ';
      
      const config = parseServerConfig();
      
      expect(config.corsOrigins).toEqual(['https://app1.com', 'https://app2.com', 'https://app3.com']);
    });

    it('should handle boolean environment variables correctly', () => {
      process.env.ENABLE_IPV6 = 'false';
      process.env.ALLOW_PRIVATE_NETWORK_ACCESS = 'true';
      process.env.RAILWAY_INTERNAL_ACCESS = 'false';
      
      const config = parseServerConfig();
      
      expect(config.enableIPv6).toBe(false);
      expect(config.allowPrivateNetworkAccess).toBe(true);
      expect(config.railwayInternalAccess).toBe(false);
    });
  });

  describe('createNetworkConfig', () => {
    it('should create local network configuration', () => {
      const serverConfig: ServerConfig = {
        mode: 'stdio',
        port: 3000,
        host: 'localhost',
        enableIPv6: false
      };
      
      const networkConfig = createNetworkConfig(serverConfig);
      
      expect(networkConfig.preferIPv6).toBe(false);
      expect(networkConfig.dualStack).toBe(false);
      expect(networkConfig.bindAddress).toBe('localhost');
      expect(networkConfig.port).toBe(3000);
    });

    it('should create Railway network configuration with IPv6 preference', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      
      const serverConfig: ServerConfig = {
        mode: 'http',
        port: 8080,
        host: '0.0.0.0',
        enableIPv6: true
      };
      
      const networkConfig = createNetworkConfig(serverConfig);
      
      expect(networkConfig.preferIPv6).toBe(true);
      expect(networkConfig.dualStack).toBe(true);
      expect(networkConfig.bindAddress).toBe('::');
      expect(networkConfig.port).toBe(8080);
    });

    it('should respect explicit IPv6 environment variables', () => {
      process.env.IPV6_PREFER = 'false';
      process.env.IPV6_DUAL_STACK = 'false';
      
      const serverConfig: ServerConfig = {
        mode: 'http',
        port: 3000,
        host: '0.0.0.0',
        enableIPv6: true
      };
      
      const networkConfig = createNetworkConfig(serverConfig);
      
      expect(networkConfig.preferIPv6).toBe(false);
      expect(networkConfig.dualStack).toBe(false);
      expect(networkConfig.bindAddress).toBe('0.0.0.0');
    });
  });

  describe('validateEnvironmentVariables', () => {
    it('should pass validation for valid local configuration', () => {
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for valid Railway configuration', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      process.env.PORT = '3000';
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing PORT in Railway environment', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      // PORT not set
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PORT environment variable is required for Railway deployment');
    });

    it('should fail validation for invalid PORT value', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      process.env.PORT = 'invalid';
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid PORT value: invalid');
    });

    it('should fail validation for PORT out of range', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      process.env.PORT = '70000';
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Must be a number between 1 and 65535');
    });

    it('should fail validation for invalid CORS origins', () => {
      process.env.CORS_ORIGINS = 'invalid-url,another-invalid';
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid CORS origins detected');
    });

    it('should fail validation for invalid boolean values', () => {
      process.env.ENABLE_IPV6 = 'maybe';
      process.env.IPV6_DUAL_STACK = 'yes';
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid boolean value for ENABLE_IPV6: maybe. Must be \'true\' or \'false\'');
      expect(result.errors).toContain('Invalid boolean value for IPV6_DUAL_STACK: yes. Must be \'true\' or \'false\'');
    });

    it('should fail validation for invalid server mode', () => {
      process.env.MCP_SERVER_MODE = 'invalid';
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid MCP_SERVER_MODE: invalid. Must be \'stdio\', \'http\', or \'dual\'');
    });

    it('should generate warnings for missing optional Railway variables', () => {
      process.env.PORT = '3000';
      // Missing RAILWAY_ENVIRONMENT and RAILWAY_SERVICE_NAME
      
      const result = validateEnvironmentVariables();
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('RAILWAY_ENVIRONMENT not set - this may indicate the app is not running on Railway');
      expect(result.warnings).toContain('RAILWAY_SERVICE_NAME not set - service identification may be limited');
    });

    it('should generate warnings for missing Gmail credentials', () => {
      const result = validateEnvironmentVariables();
      
      expect(result.warnings).toContain('Gmail credential paths not specified - using default locations in ~/.gmail-mcp/');
    });
  });

  describe('validateServerConfig', () => {
    it('should pass validation for valid stdio configuration', () => {
      const config: ServerConfig = {
        mode: 'stdio'
      };
      
      expect(() => validateServerConfig(config)).not.toThrow();
    });

    it('should pass validation for valid HTTP configuration', () => {
      const config: ServerConfig = {
        mode: 'http',
        port: 3000
      };
      
      expect(() => validateServerConfig(config)).not.toThrow();
    });

    it('should fail validation for invalid mode', () => {
      const config: ServerConfig = {
        mode: 'invalid' as any
      };
      
      expect(() => validateServerConfig(config)).toThrow('Invalid server mode: invalid');
    });

    it('should fail validation for invalid port in HTTP mode', () => {
      const config: ServerConfig = {
        mode: 'http',
        port: 70000
      };
      
      expect(() => validateServerConfig(config)).toThrow('Invalid port: 70000');
    });

    it('should fail validation for missing port in HTTP mode', () => {
      const config: ServerConfig = {
        mode: 'http'
      };
      
      expect(() => validateServerConfig(config)).toThrow('Invalid port: undefined');
    });

    it('should fail validation for invalid CORS origins type', () => {
      const config: ServerConfig = {
        mode: 'http',
        port: 3000,
        corsOrigins: 'not-an-array' as any
      };
      
      expect(() => validateServerConfig(config)).toThrow('CORS origins must be an array of strings');
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return current environment configuration', () => {
      process.env.PORT = '8080';
      process.env.RAILWAY_ENVIRONMENT = 'production';
      process.env.MCP_SERVER_MODE = 'dual';
      process.env.ENABLE_IPV6 = 'true';
      
      const envConfig = getEnvironmentConfig();
      
      expect(envConfig.PORT).toBe(8080);
      expect(envConfig.RAILWAY_ENVIRONMENT).toBe('production');
      expect(envConfig.MCP_SERVER_MODE).toBe('dual');
      expect(envConfig.ENABLE_IPV6).toBe(true);
    });

    it('should handle undefined environment variables', () => {
      const envConfig = getEnvironmentConfig();
      
      expect(envConfig.PORT).toBeUndefined();
      expect(envConfig.RAILWAY_ENVIRONMENT).toBeUndefined();
      expect(envConfig.MCP_SERVER_MODE).toBeUndefined();
      expect(envConfig.ENABLE_IPV6).toBeUndefined();
    });

    it('should parse boolean values correctly', () => {
      process.env.ENABLE_IPV6 = 'false';
      process.env.IPV6_DUAL_STACK = 'true';
      process.env.ALLOW_PRIVATE_NETWORK_ACCESS = 'TRUE';
      
      const envConfig = getEnvironmentConfig();
      
      expect(envConfig.ENABLE_IPV6).toBe(false);
      expect(envConfig.IPV6_DUAL_STACK).toBe(true);
      expect(envConfig.ALLOW_PRIVATE_NETWORK_ACCESS).toBe(true);
    });
  });

  describe('generatePrivateNetworkOrigins', () => {
    it('should generate private network origins when enabled', () => {
      const config: ServerConfig = {
        mode: 'http',
        allowPrivateNetworkAccess: true,
        railwayInternalAccess: false
      };
      
      const origins = generatePrivateNetworkOrigins(config);
      
      expect(origins).toContain('http://10.*');
      expect(origins).toContain('https://192.168.*');
      expect(origins).toContain('http://localhost:*');
      expect(origins).not.toContain('https://*.railway.app');
    });

    it('should generate Railway origins when enabled', () => {
      const config: ServerConfig = {
        mode: 'http',
        allowPrivateNetworkAccess: false,
        railwayInternalAccess: true
      };
      
      const origins = generatePrivateNetworkOrigins(config);
      
      expect(origins).toContain('https://*.railway.app');
      expect(origins).toContain('https://*.up.railway.app');
      expect(origins).not.toContain('http://10.*');
    });

    it('should generate both types when both are enabled', () => {
      const config: ServerConfig = {
        mode: 'http',
        allowPrivateNetworkAccess: true,
        railwayInternalAccess: true
      };
      
      const origins = generatePrivateNetworkOrigins(config);
      
      expect(origins).toContain('http://10.*');
      expect(origins).toContain('https://*.railway.app');
    });

    it('should return empty array when both are disabled', () => {
      const config: ServerConfig = {
        mode: 'http',
        allowPrivateNetworkAccess: false,
        railwayInternalAccess: false
      };
      
      const origins = generatePrivateNetworkOrigins(config);
      
      expect(origins).toHaveLength(0);
    });
  });

  describe('getMergedCORSOrigins', () => {
    it('should merge configured and generated origins', () => {
      const config: ServerConfig = {
        mode: 'http',
        corsOrigins: ['https://custom.com', 'http://test.local'],
        allowPrivateNetworkAccess: true,
        railwayInternalAccess: false
      };
      
      const mergedOrigins = getMergedCORSOrigins(config);
      
      expect(mergedOrigins).toContain('https://custom.com');
      expect(mergedOrigins).toContain('http://test.local');
      expect(mergedOrigins).toContain('http://10.*');
      expect(mergedOrigins).toContain('https://192.168.*');
    });

    it('should deduplicate origins', () => {
      const config: ServerConfig = {
        mode: 'http',
        corsOrigins: ['http://localhost:*', 'https://custom.com'],
        allowPrivateNetworkAccess: true,
        railwayInternalAccess: false
      };
      
      const mergedOrigins = getMergedCORSOrigins(config);
      
      // Should only have one instance of http://localhost:*
      const localhostCount = mergedOrigins.filter(origin => origin === 'http://localhost:*').length;
      expect(localhostCount).toBe(1);
    });

    it('should handle empty configured origins', () => {
      const config: ServerConfig = {
        mode: 'http',
        allowPrivateNetworkAccess: true,
        railwayInternalAccess: false
      };
      
      const mergedOrigins = getMergedCORSOrigins(config);
      
      expect(mergedOrigins.length).toBeGreaterThan(0);
      expect(mergedOrigins).toContain('http://10.*');
    });
  });

  describe('getConfigurationGuidance', () => {
    it('should provide comprehensive configuration guidance', () => {
      const guidance = getConfigurationGuidance();
      
      expect(guidance.localDefaults).toBeDefined();
      expect(guidance.railwayDefaults).toBeDefined();
      expect(guidance.requiredForRailway).toContain('PORT');
      expect(guidance.optionalForRailway).toContain('MCP_SERVER_MODE');
      expect(guidance.examples).toBeDefined();
      expect(guidance.examples.CORS_ORIGINS).toBeDefined();
    });

    it('should have different defaults for local and Railway', () => {
      const guidance = getConfigurationGuidance();
      
      expect(guidance.localDefaults.MCP_SERVER_MODE).toBe('stdio');
      expect(guidance.railwayDefaults.MCP_SERVER_MODE).toBe('http');
      expect(guidance.localDefaults.ENABLE_IPV6).toBe('false');
      expect(guidance.railwayDefaults.ENABLE_IPV6).toBe('true');
    });
  });

  describe('parseAndValidateServerConfig', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should successfully parse and validate correct configuration', () => {
      process.env.PORT = '3000';
      
      const config = parseAndValidateServerConfig();
      
      expect(config).toBeDefined();
      expect(config.port).toBe(3000);
    });

    it('should throw error for invalid environment variables', () => {
      process.env.RAILWAY_ENVIRONMENT = 'production';
      process.env.PORT = 'invalid';
      
      expect(() => parseAndValidateServerConfig()).toThrow('Configuration validation failed');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration Errors'));
    });

    it('should throw error for invalid server configuration', () => {
      process.env.MCP_SERVER_MODE = 'http';
      // Missing PORT for HTTP mode
      
      expect(() => parseAndValidateServerConfig()).toThrow();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle case-insensitive boolean parsing', () => {
      process.env.ENABLE_IPV6 = 'TRUE';
      process.env.IPV6_DUAL_STACK = 'False';
      process.env.ALLOW_PRIVATE_NETWORK_ACCESS = 'tRuE';
      
      const envConfig = getEnvironmentConfig();
      
      expect(envConfig.ENABLE_IPV6).toBe(true);
      expect(envConfig.IPV6_DUAL_STACK).toBe(false);
      expect(envConfig.ALLOW_PRIVATE_NETWORK_ACCESS).toBe(true);
    });

    it('should handle empty string environment variables', () => {
      process.env.CORS_ORIGINS = '';
      process.env.GMAIL_CREDENTIALS_PATH = '';
      
      const config = parseServerConfig();
      
      expect(config.corsOrigins).toEqual([]); // Empty string becomes empty array after filtering
    });

    it('should handle whitespace-only CORS origins', () => {
      process.env.CORS_ORIGINS = '   ,   ,   ';
      
      const config = parseServerConfig();
      
      expect(config.corsOrigins).toEqual(['', '', '']); // Trimmed empty strings
    });

    it('should validate IPv4 private ranges correctly', () => {
      const config: ServerConfig = {
        mode: 'http',
        allowPrivateNetworkAccess: true,
        railwayInternalAccess: false
      };
      
      const origins = generatePrivateNetworkOrigins(config);
      
      // Check that all private ranges are included
      expect(origins).toContain('http://10.*');
      expect(origins).toContain('http://172.16.*');
      expect(origins).toContain('http://172.31.*');
      expect(origins).toContain('http://192.168.*');
      
      // Check that we don't include non-private ranges
      expect(origins).not.toContain('http://172.15.*');
      expect(origins).not.toContain('http://172.32.*');
    });
  });
});