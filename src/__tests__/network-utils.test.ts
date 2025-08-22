/**
 * Unit tests for network configuration and IPv6/IPv4 detection
 * Tests Requirements: 2.1, 2.2, 2.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import {
  detectNetworkStack,
  bindToOptimalNetwork,
  createDualStackNetworkConfig,
  logNetworkConfiguration,
  getNetworkRecommendations,
  handleNetworkBindingError,
  NetworkStackInfo,
  BindResult
} from '../network-utils.js';
import { NetworkConfig } from '../config.js';

// Mock the http module
vi.mock('http', () => ({
  createServer: vi.fn()
}));

describe('Network Utils', () => {
  let mockServer: any;
  let mockListen: any;
  let mockClose: any;
  let mockOn: any;
  let mockOnce: any;
  let mockAddress: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create mock server methods
    mockListen = vi.fn();
    mockClose = vi.fn();
    mockOn = vi.fn();
    mockOnce = vi.fn();
    mockAddress = vi.fn();

    // Create mock server object
    mockServer = {
      listen: mockListen,
      close: mockClose,
      on: mockOn,
      once: mockOnce,
      address: mockAddress,
      _handle: {
        setIPv6Only: vi.fn()
      }
    };

    // Mock createServer to return our mock server
    (createServer as any).mockReturnValue(mockServer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectNetworkStack', () => {
    it('should detect both IPv4 and IPv6 as available when both work', async () => {
      // Mock successful binding for both IPv4 and IPv6
      mockListen.mockImplementation((port: number, address: string, callback?: () => void) => {
        if (callback) callback();
      });
      mockClose.mockImplementation((callback?: () => void) => {
        if (callback) callback();
      });

      const result = await detectNetworkStack();

      expect(result.ipv4Available).toBe(true);
      expect(result.ipv6Available).toBe(true);
      expect(result.preferredStack).toBe('dual');
    });

    it('should detect only IPv4 when IPv6 fails', async () => {
      // Mock IPv4 success, IPv6 failure
      mockListen.mockImplementation((port: number, address: string, callback?: () => void) => {
        if (address === '0.0.0.0') {
          if (callback) callback();
        } else if (address === '::') {
          // Simulate IPv6 failure
          setTimeout(() => mockOn.mock.calls.find(call => call[0] === 'error')?.[1]?.(new Error('IPv6 not available')), 10);
        }
      });
      mockClose.mockImplementation((callback?: () => void) => {
        if (callback) callback();
      });

      const result = await detectNetworkStack();

      expect(result.ipv4Available).toBe(true);
      expect(result.ipv6Available).toBe(false);
      expect(result.preferredStack).toBe('ipv4');
    });

    it('should detect only IPv6 when IPv4 fails', async () => {
      // Mock IPv6 success, IPv4 failure
      mockListen.mockImplementation((port: number, address: string, callback?: () => void) => {
        if (address === '::') {
          if (callback) callback();
        } else if (address === '0.0.0.0') {
          // Simulate IPv4 failure
          setTimeout(() => mockOn.mock.calls.find(call => call[0] === 'error')?.[1]?.(new Error('IPv4 not available')), 10);
        }
      });
      mockClose.mockImplementation((callback?: () => void) => {
        if (callback) callback();
      });

      const result = await detectNetworkStack();

      expect(result.ipv4Available).toBe(false);
      expect(result.ipv6Available).toBe(true);
      expect(result.preferredStack).toBe('ipv6');
    });

    it('should handle timeout scenarios gracefully', async () => {
      // Mock no response (timeout scenario)
      mockListen.mockImplementation(() => {
        // Don't call callback, simulate hanging
      });
      mockClose.mockImplementation((callback?: () => void) => {
        if (callback) callback();
      });

      const result = await detectNetworkStack();

      expect(result.ipv4Available).toBe(false);
      expect(result.ipv6Available).toBe(false);
      expect(result.preferredStack).toBe('ipv4'); // Default fallback
    });
  });

  describe('bindToOptimalNetwork', () => {
    const mockCreateServerFn = () => mockServer;

    it('should successfully bind to IPv6 dual-stack when available', async () => {
      const networkConfig: NetworkConfig = {
        preferIPv6: true,
        dualStack: true,
        bindAddress: '::',
        port: 3000
      };

      // Mock successful IPv6 binding
      mockOnce.mockImplementation((event: string, callback: any) => {
        if (event === 'listening') {
          setTimeout(callback, 10);
        }
      });
      mockAddress.mockReturnValue({ address: '::', port: 3000 });

      const result = await bindToOptimalNetwork(networkConfig, mockCreateServerFn);

      expect(result.success).toBe(true);
      expect(result.family).toBe('IPv6');
      expect(result.address).toBe('::');
      expect(result.port).toBe(3000);
    });

    it('should fallback to IPv4 when IPv6 dual-stack fails', async () => {
      const networkConfig: NetworkConfig = {
        preferIPv6: true,
        dualStack: true,
        bindAddress: '::',
        port: 3000
      };

      let bindAttempt = 0;
      mockOnce.mockImplementation((event: string, callback: any) => {
        if (event === 'error' && bindAttempt === 0) {
          setTimeout(() => callback(new Error('IPv6 binding failed')), 10);
        } else if (event === 'listening' && bindAttempt === 1) {
          setTimeout(callback, 10);
        }
      });

      // Mock different addresses for different attempts
      mockAddress.mockImplementation(() => {
        if (bindAttempt === 1) {
          return { address: '0.0.0.0', port: 3000 };
        }
        return null;
      });

      mockListen.mockImplementation(() => {
        bindAttempt++;
      });

      const result = await bindToOptimalNetwork(networkConfig, mockCreateServerFn);

      expect(result.success).toBe(true);
      expect(result.family).toBe('IPv4');
      expect(result.address).toBe('0.0.0.0');
    });

    it('should handle complete binding failure gracefully', async () => {
      const networkConfig: NetworkConfig = {
        preferIPv6: false,
        dualStack: false,
        bindAddress: '0.0.0.0',
        port: 3000
      };

      // Mock all binding attempts to fail
      mockOnce.mockImplementation((event: string, callback: any) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('All binding failed')), 10);
        }
      });

      const result = await bindToOptimalNetwork(networkConfig, mockCreateServerFn);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('All binding failed');
    });
  });

  describe('createDualStackNetworkConfig', () => {
    it('should create IPv6-preferred dual-stack config by default', () => {
      const config = createDualStackNetworkConfig(3000);

      expect(config.port).toBe(3000);
      expect(config.preferIPv6).toBe(true);
      expect(config.dualStack).toBe(true);
      expect(config.bindAddress).toBe('::');
    });

    it('should create IPv4-preferred config when specified', () => {
      const config = createDualStackNetworkConfig(8080, false, true);

      expect(config.port).toBe(8080);
      expect(config.preferIPv6).toBe(false);
      expect(config.dualStack).toBe(true);
      expect(config.bindAddress).toBe('0.0.0.0');
    });

    it('should create single-stack config when dual-stack is disabled', () => {
      const config = createDualStackNetworkConfig(5000, true, false);

      expect(config.port).toBe(5000);
      expect(config.preferIPv6).toBe(true);
      expect(config.dualStack).toBe(false);
      expect(config.bindAddress).toBe('::');
    });
  });

  describe('getNetworkRecommendations', () => {
    it('should recommend IPv6 disable when IPv6 is unavailable', () => {
      const stackInfo: NetworkStackInfo = {
        ipv4Available: true,
        ipv6Available: false,
        preferredStack: 'ipv4'
      };

      const recommendations = getNetworkRecommendations(stackInfo);

      expect(recommendations).toContain('IPv6 is not available on this system.');
      expect(recommendations).toContain('Consider setting ENABLE_IPV6=false to disable IPv6 attempts.');
      expect(recommendations).toContain('The server will automatically fall back to IPv4-only mode.');
    });

    it('should recommend IPv6-only setup when IPv4 is unavailable', () => {
      const stackInfo: NetworkStackInfo = {
        ipv4Available: false,
        ipv6Available: true,
        preferredStack: 'ipv6'
      };

      const recommendations = getNetworkRecommendations(stackInfo);

      expect(recommendations).toContain('IPv4 is not available on this system.');
      expect(recommendations).toContain('The server will use IPv6-only mode.');
      expect(recommendations).toContain('Ensure clients can connect via IPv6.');
    });

    it('should recommend dual-stack when both are available', () => {
      const stackInfo: NetworkStackInfo = {
        ipv4Available: true,
        ipv6Available: true,
        preferredStack: 'dual'
      };

      const recommendations = getNetworkRecommendations(stackInfo);

      expect(recommendations).toContain('Both IPv4 and IPv6 are available.');
      expect(recommendations).toContain('Consider enabling dual-stack mode for maximum compatibility.');
    });

    it('should provide system check recommendations when no stacks are available', () => {
      const stackInfo: NetworkStackInfo = {
        ipv4Available: false,
        ipv6Available: false,
        preferredStack: 'ipv4'
      };

      const recommendations = getNetworkRecommendations(stackInfo);

      expect(recommendations).toContain('No network stacks appear to be available. Check system network configuration.');
      expect(recommendations).toContain('Ensure the application has permission to bind to network interfaces.');
    });
  });

  describe('handleNetworkBindingError', () => {
    it('should create detailed error message with configuration and recommendations', () => {
      const originalError = new Error('EADDRINUSE: Address already in use');
      const networkConfig: NetworkConfig = {
        preferIPv6: true,
        dualStack: true,
        bindAddress: '::',
        port: 3000
      };
      const stackInfo: NetworkStackInfo = {
        ipv4Available: true,
        ipv6Available: true,
        preferredStack: 'dual'
      };

      const enhancedError = handleNetworkBindingError(originalError, networkConfig, stackInfo);

      expect(enhancedError.message).toContain('Network binding failed: EADDRINUSE: Address already in use');
      expect(enhancedError.message).toContain('Configuration:');
      expect(enhancedError.message).toContain('Preferred IPv6: true');
      expect(enhancedError.message).toContain('Dual-stack: true');
      expect(enhancedError.message).toContain('Port: 3000');
      expect(enhancedError.message).toContain('System capabilities:');
      expect(enhancedError.message).toContain('IPv4 available: true');
      expect(enhancedError.message).toContain('IPv6 available: true');
      expect(enhancedError.message).toContain('Recommendations:');
    });

    it('should include appropriate recommendations based on stack availability', () => {
      const originalError = new Error('Network error');
      const networkConfig: NetworkConfig = {
        preferIPv6: true,
        dualStack: true,
        bindAddress: '::',
        port: 3000
      };
      const stackInfo: NetworkStackInfo = {
        ipv4Available: true,
        ipv6Available: false,
        preferredStack: 'ipv4'
      };

      const enhancedError = handleNetworkBindingError(originalError, networkConfig, stackInfo);

      expect(enhancedError.message).toContain('Consider setting ENABLE_IPV6=false to disable IPv6 attempts.');
    });
  });

  describe('logNetworkConfiguration', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log comprehensive network configuration summary', () => {
      const bindResult: BindResult = {
        success: true,
        address: '::',
        port: 3000,
        family: 'IPv6',
        server: mockServer
      };
      const networkConfig: NetworkConfig = {
        preferIPv6: true,
        dualStack: true,
        bindAddress: '::',
        port: 3000
      };
      const stackInfo: NetworkStackInfo = {
        ipv4Available: true,
        ipv6Available: true,
        preferredStack: 'dual'
      };

      logNetworkConfiguration(bindResult, networkConfig, stackInfo);

      expect(consoleSpy).toHaveBeenCalledWith('=== Network Configuration Summary ===');
      expect(consoleSpy).toHaveBeenCalledWith('Requested configuration:', expect.objectContaining({
        preferIPv6: true,
        dualStack: true,
        bindAddress: '::',
        port: 3000
      }));
      expect(consoleSpy).toHaveBeenCalledWith('System capabilities:', expect.objectContaining({
        ipv4Available: true,
        ipv6Available: true,
        preferredStack: 'dual'
      }));
      expect(consoleSpy).toHaveBeenCalledWith('Binding result:', expect.objectContaining({
        success: true,
        actualAddress: '::',
        actualPort: 3000,
        family: 'IPv6'
      }));
      expect(consoleSpy).toHaveBeenCalledWith('Network mode:', 'IPv6 dual-stack');
    });

    it('should log IPv4-only mode when binding to IPv4', () => {
      const bindResult: BindResult = {
        success: true,
        address: '0.0.0.0',
        port: 3000,
        family: 'IPv4',
        server: mockServer
      };
      const networkConfig: NetworkConfig = {
        preferIPv6: false,
        dualStack: false,
        bindAddress: '0.0.0.0',
        port: 3000
      };
      const stackInfo: NetworkStackInfo = {
        ipv4Available: true,
        ipv6Available: false,
        preferredStack: 'ipv4'
      };

      logNetworkConfiguration(bindResult, networkConfig, stackInfo);

      expect(consoleSpy).toHaveBeenCalledWith('Network mode:', 'IPv4 only');
    });

    it('should log error information when binding fails', () => {
      const bindResult: BindResult = {
        success: false,
        address: '::',
        port: 3000,
        family: 'IPv6',
        error: new Error('Binding failed')
      };
      const networkConfig: NetworkConfig = {
        preferIPv6: true,
        dualStack: true,
        bindAddress: '::',
        port: 3000
      };
      const stackInfo: NetworkStackInfo = {
        ipv4Available: true,
        ipv6Available: true,
        preferredStack: 'dual'
      };

      logNetworkConfiguration(bindResult, networkConfig, stackInfo);

      expect(consoleSpy).toHaveBeenCalledWith('Binding result:', expect.objectContaining({
        success: false,
        error: 'Binding failed'
      }));
    });
  });
});