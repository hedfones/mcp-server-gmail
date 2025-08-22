/**
 * Unit tests for CORS middleware and origin validation
 * Tests Requirements: 5.1, 5.2, 5.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import {
  CORSMiddleware,
  DEFAULT_CORS_CONFIG,
  createCORSMiddleware,
  CORSConfig,
  CORSValidationResult
} from '../cors-middleware.js';

describe('CORS Middleware', () => {
  let corsMiddleware: CORSMiddleware;
  let mockRequest: Partial<IncomingMessage>;
  let mockResponse: Partial<ServerResponse>;
  let mockSetHeader: any;
  let mockWriteHead: any;
  let mockEnd: any;

  beforeEach(() => {
    // Create mock response methods
    mockSetHeader = vi.fn();
    mockWriteHead = vi.fn();
    mockEnd = vi.fn();

    // Create mock request and response objects
    mockRequest = {
      method: 'GET',
      headers: {}
    };

    mockResponse = {
      setHeader: mockSetHeader,
      writeHead: mockWriteHead,
      end: mockEnd
    };

    // Create CORS middleware instance
    corsMiddleware = new CORSMiddleware();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateOrigin', () => {
    it('should allow private network IPv4 origins', () => {
      const testOrigins = [
        'http://10.0.0.1:3000',
        'https://172.16.0.1:8080',
        'http://192.168.1.100:5000'
      ];

      testOrigins.forEach(origin => {
        const result = corsMiddleware.validateOrigin(origin);
        expect(result.allowed).toBe(true);
        expect(result.origin).toBe(origin);
      });
    });

    it('should allow localhost origins', () => {
      const testOrigins = [
        'http://localhost:3000',
        'https://localhost:8080',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:8080'
      ];

      testOrigins.forEach(origin => {
        const result = corsMiddleware.validateOrigin(origin);
        expect(result.allowed).toBe(true);
        expect(result.origin).toBe(origin);
      });
    });

    it('should allow Railway origins', () => {
      const testOrigins = [
        'https://myapp.railway.app',
        'https://myservice.up.railway.app'
      ];

      testOrigins.forEach(origin => {
        const result = corsMiddleware.validateOrigin(origin);
        expect(result.allowed).toBe(true);
        expect(result.origin).toBe(origin);
      });
    });

    it('should allow IPv6 localhost origins', () => {
      const testOrigins = [
        'http://[::1]:3000',
        'https://[::1]:8080'
      ];

      testOrigins.forEach(origin => {
        const result = corsMiddleware.validateOrigin(origin);
        expect(result.allowed).toBe(true);
        expect(result.origin).toBe(origin);
      });
    });

    it('should reject public internet origins', () => {
      const testOrigins = [
        'https://google.com',
        'http://example.com:3000',
        'https://malicious-site.net',
        'http://8.8.8.8:80'
      ];

      testOrigins.forEach(origin => {
        const result = corsMiddleware.validateOrigin(origin);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('not in allowed list');
      });
    });

    it('should reject empty or missing origins', () => {
      const result = corsMiddleware.validateOrigin('');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No origin header provided');
    });

    it('should handle wildcard patterns correctly', () => {
      // Test that wildcard patterns in default config work
      const result = corsMiddleware.validateOrigin('http://10.5.3.2:4000');
      expect(result.allowed).toBe(true);
    });
  });

  describe('isPrivateNetworkOrigin', () => {
    it('should identify IPv4 private network ranges', () => {
      const privateOrigins = [
        'http://10.0.0.1',
        'https://172.16.0.1',
        'http://172.31.255.255',
        'https://192.168.1.1'
      ];

      privateOrigins.forEach(origin => {
        expect(corsMiddleware.isPrivateNetworkOrigin(origin)).toBe(true);
      });
    });

    it('should identify localhost variations', () => {
      const localhostOrigins = [
        'http://localhost',
        'https://127.0.0.1',
        'http://[::1]'
      ];

      localhostOrigins.forEach(origin => {
        expect(corsMiddleware.isPrivateNetworkOrigin(origin)).toBe(true);
      });
    });

    it('should reject public IP addresses', () => {
      const publicOrigins = [
        'https://8.8.8.8',
        'http://1.1.1.1',
        'https://208.67.222.222'
      ];

      publicOrigins.forEach(origin => {
        expect(corsMiddleware.isPrivateNetworkOrigin(origin)).toBe(false);
      });
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidOrigins = [
        'not-a-url',
        'http://',
        'ftp://invalid.com',
        ''
      ];

      invalidOrigins.forEach(origin => {
        expect(corsMiddleware.isPrivateNetworkOrigin(origin)).toBe(false);
      });
    });

    it('should identify IPv6 private addresses', () => {
      const ipv6Origins = [
        'http://[::1]',
        'https://[fc00::1]',
        'http://[fd00::1]'
      ];

      ipv6Origins.forEach(origin => {
        expect(corsMiddleware.isPrivateNetworkOrigin(origin)).toBe(true);
      });
    });
  });

  describe('setCORSHeaders', () => {
    it('should set appropriate headers for allowed origins', () => {
      mockRequest.headers = { origin: 'http://localhost:3000' };

      const result = corsMiddleware.setCORSHeaders(
        mockRequest as IncomingMessage,
        mockResponse as ServerResponse
      );

      expect(result.allowed).toBe(true);
      expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
      expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', expect.stringContaining('Content-Type'));
    });

    it('should set null origin for rejected requests', () => {
      mockRequest.headers = { origin: 'https://malicious.com' };

      const result = corsMiddleware.setCORSHeaders(
        mockRequest as IncomingMessage,
        mockResponse as ServerResponse
      );

      expect(result.allowed).toBe(false);
      expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'null');
    });

    it('should set credentials header when configured', () => {
      const corsWithCredentials = new CORSMiddleware({ credentials: true });
      mockRequest.headers = { origin: 'http://localhost:3000' };

      corsWithCredentials.setCORSHeaders(
        mockRequest as IncomingMessage,
        mockResponse as ServerResponse
      );

      expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    });

    it('should set max-age header when configured', () => {
      const corsWithMaxAge = new CORSMiddleware({ maxAge: 3600 });
      mockRequest.headers = { origin: 'http://localhost:3000' };

      corsWithMaxAge.setCORSHeaders(
        mockRequest as IncomingMessage,
        mockResponse as ServerResponse
      );

      expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Max-Age', '3600');
    });
  });

  describe('handlePreflightRequest', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should handle OPTIONS requests for allowed origins', () => {
      mockRequest.method = 'OPTIONS';
      mockRequest.headers = { origin: 'http://localhost:3000' };

      const handled = corsMiddleware.handlePreflightRequest(
        mockRequest as IncomingMessage,
        mockResponse as ServerResponse
      );

      expect(handled).toBe(true);
      expect(mockWriteHead).toHaveBeenCalledWith(200);
      expect(mockEnd).toHaveBeenCalled();
    });

    it('should reject OPTIONS requests for disallowed origins', () => {
      mockRequest.method = 'OPTIONS';
      mockRequest.headers = { origin: 'https://malicious.com' };

      const handled = corsMiddleware.handlePreflightRequest(
        mockRequest as IncomingMessage,
        mockResponse as ServerResponse
      );

      expect(handled).toBe(true);
      expect(mockWriteHead).toHaveBeenCalledWith(403, { 'Content-Type': 'application/json' });
      expect(mockEnd).toHaveBeenCalledWith(expect.stringContaining('CORS policy violation'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CORS preflight rejected'));
    });

    it('should not handle non-OPTIONS requests', () => {
      mockRequest.method = 'GET';
      mockRequest.headers = { origin: 'http://localhost:3000' };

      const handled = corsMiddleware.handlePreflightRequest(
        mockRequest as IncomingMessage,
        mockResponse as ServerResponse
      );

      expect(handled).toBe(false);
      expect(mockWriteHead).not.toHaveBeenCalled();
      expect(mockEnd).not.toHaveBeenCalled();
    });

    it('should provide detailed error information for rejected preflight requests', () => {
      mockRequest.method = 'OPTIONS';
      mockRequest.headers = { origin: 'https://external.com' };

      corsMiddleware.handlePreflightRequest(
        mockRequest as IncomingMessage,
        mockResponse as ServerResponse
      );

      const errorResponse = mockEnd.mock.calls[0][0];
      const parsedError = JSON.parse(errorResponse);

      expect(parsedError.error).toBe('CORS policy violation');
      expect(parsedError.origin).toBe('https://external.com');
      expect(parsedError.isPrivateNetwork).toBe(false);
      expect(parsedError.allowedPatterns).toBeDefined();
    });
  });

  describe('middleware function', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should call next function for non-preflight requests', () => {
      const nextFn = vi.fn();
      const middleware = corsMiddleware.middleware();

      mockRequest.method = 'GET';
      mockRequest.headers = { origin: 'http://localhost:3000' };

      middleware(mockRequest as IncomingMessage, mockResponse as ServerResponse, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should not call next function for preflight requests', () => {
      const nextFn = vi.fn();
      const middleware = corsMiddleware.middleware();

      mockRequest.method = 'OPTIONS';
      mockRequest.headers = { origin: 'http://localhost:3000' };

      middleware(mockRequest as IncomingMessage, mockResponse as ServerResponse, nextFn);

      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should log warnings for failed CORS validation on non-preflight requests', () => {
      const nextFn = vi.fn();
      const middleware = corsMiddleware.middleware();

      mockRequest.method = 'POST';
      mockRequest.headers = { origin: 'https://malicious.com' };

      middleware(mockRequest as IncomingMessage, mockResponse as ServerResponse, nextFn);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('CORS validation failed'));
      expect(nextFn).toHaveBeenCalled(); // Should still call next for non-preflight
    });
  });

  describe('validateOrigins batch validation', () => {
    it('should validate multiple origins and provide summary', () => {
      const testOrigins = [
        'http://localhost:3000',
        'https://malicious.com',
        'http://192.168.1.1:8080',
        'https://myapp.railway.app',
        'http://external.example.com'
      ];

      const result = corsMiddleware.validateOrigins(testOrigins);

      expect(result.allowed).toHaveLength(3); // localhost, 192.168.1.1, railway.app
      expect(result.rejected).toHaveLength(2); // malicious.com, external.example.com
      expect(result.summary.total).toBe(5);
      expect(result.summary.allowedCount).toBe(3);
      expect(result.summary.rejectedCount).toBe(2);
      expect(result.summary.privateNetworkCount.allowed).toBe(2); // localhost, 192.168.1.1
      expect(result.summary.railwayCount.allowed).toBe(1); // railway.app
    });

    it('should handle empty origin list', () => {
      const result = corsMiddleware.validateOrigins([]);

      expect(result.allowed).toHaveLength(0);
      expect(result.rejected).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });
  });

  describe('configuration management', () => {
    it('should update configuration correctly', () => {
      const newConfig: Partial<CORSConfig> = {
        methods: ['GET', 'POST', 'PUT'],
        credentials: true
      };

      corsMiddleware.updateConfig(newConfig);
      const currentConfig = corsMiddleware.getConfig();

      expect(currentConfig.methods).toEqual(['GET', 'POST', 'PUT']);
      expect(currentConfig.credentials).toBe(true);
      expect(currentConfig.origins).toEqual(DEFAULT_CORS_CONFIG.origins); // Should preserve other settings
    });

    it('should return current configuration', () => {
      const config = corsMiddleware.getConfig();

      expect(config.origins).toBeDefined();
      expect(config.methods).toBeDefined();
      expect(config.allowedHeaders).toBeDefined();
      expect(config.credentials).toBeDefined();
    });
  });

  describe('createCORSMiddleware factory function', () => {
    it('should create middleware with default configuration', () => {
      const middleware = createCORSMiddleware();
      const config = middleware.getConfig();

      expect(config.origins).toEqual(DEFAULT_CORS_CONFIG.origins);
    });

    it('should merge environment origins with defaults', () => {
      const envOrigins = ['https://custom.example.com', 'http://test.local:3000'];
      const middleware = createCORSMiddleware(envOrigins);
      const config = middleware.getConfig();

      expect(config.origins).toContain('https://custom.example.com');
      expect(config.origins).toContain('http://test.local:3000');
      expect(config.origins).toContain('http://localhost:*'); // Should still have defaults
    });

    it('should handle empty environment origins', () => {
      const middleware = createCORSMiddleware([]);
      const config = middleware.getConfig();

      expect(config.origins).toEqual(DEFAULT_CORS_CONFIG.origins);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed origin headers', () => {
      const malformedOrigins = [
        'not-a-url',
        'http://',
        'https://[invalid-ipv6',
        'ftp://unsupported.com'
      ];

      malformedOrigins.forEach(origin => {
        const result = corsMiddleware.validateOrigin(origin);
        expect(result.allowed).toBe(false);
      });
    });

    it('should handle missing request headers gracefully', () => {
      mockRequest.headers = {}; // No origin header

      const result = corsMiddleware.setCORSHeaders(
        mockRequest as IncomingMessage,
        mockResponse as ServerResponse
      );

      expect(result.allowed).toBe(false);
      expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'null');
    });

    it('should handle IPv4 address edge cases', () => {
      const edgeCases = [
        'http://10.0.0.0',      // Network address
        'http://10.255.255.255', // Broadcast address
        'http://172.15.0.1',     // Just outside private range
        'http://172.32.0.1',     // Just outside private range
        'http://192.167.1.1',    // Just outside private range
        'http://192.169.1.1'     // Just outside private range
      ];

      const expectedResults = [true, true, false, false, false, false];

      edgeCases.forEach((origin, index) => {
        const isPrivate = corsMiddleware.isPrivateNetworkOrigin(origin);
        expect(isPrivate).toBe(expectedResults[index]);
      });
    });
  });
});