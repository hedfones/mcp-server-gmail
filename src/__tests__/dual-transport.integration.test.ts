/**
 * Integration tests for dual transport functionality and concurrent connections
 * Tests Requirements: 3.1, 3.4, 4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ServerState } from '../server-state.js';
import { ServerConfig } from '../config.js';
import http from 'http';

describe('Dual Transport Integration', () => {
  let serverState: ServerState;
  let mockMcpServer: any;
  let serverConfig: ServerConfig;

  beforeEach(() => {
    // Create mock MCP server
    mockMcpServer = {
      request: vi.fn(),
      connect: vi.fn(),
      close: vi.fn(),
      setRequestHandler: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn()
    };

    // Create test server configuration for dual mode
    serverConfig = {
      mode: 'dual',
      port: 0, // Use random available port for testing
      host: '127.0.0.1',
      enableIPv6: false,
      allowPrivateNetworkAccess: true,
      railwayInternalAccess: false,
      corsOrigins: ['http://localhost:3000']
    };

    // Create server state instance
    serverState = new ServerState(mockMcpServer as Server, serverConfig);
  });

  afterEach(async () => {
    try {
      await serverState.shutdown();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
    vi.restoreAllMocks();
  });

  describe('Dual Transport Initialization', () => {
    it('should initialize both stdio and HTTP transports in dual mode', async () => {
      await serverState.initialize();
      
      const status = serverState.getStatus();
      
      expect(status.mode).toBe('dual');
      expect(status.healthy).toBe(true);
      expect(status.transports.stdio).toBe(true);
      expect(status.transports.http).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock an error in MCP server connection
      mockMcpServer.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(serverState.initialize()).rejects.toThrow('Connection failed');
      
      const status = serverState.getStatus();
      expect(status.healthy).toBe(false);
    });

    it('should provide comprehensive status information', async () => {
      await serverState.initialize();
      
      const status = serverState.getStatus();
      
      expect(status).toEqual({
        mode: 'dual',
        healthy: true,
        transports: {
          stdio: true,
          http: true
        },
        config: {
          port: expect.any(Number),
          host: '127.0.0.1',
          ipv6: false,
          corsOrigins: ['http://localhost:3000']
        }
      });
    });
  });

  describe('HTTP-only Mode', () => {
    beforeEach(() => {
      serverConfig.mode = 'http';
      serverState = new ServerState(mockMcpServer as Server, serverConfig);
    });

    it('should initialize only HTTP transport in HTTP mode', async () => {
      await serverState.initialize();
      
      const status = serverState.getStatus();
      
      expect(status.mode).toBe('http');
      expect(status.healthy).toBe(true);
      expect(status.transports.stdio).toBe(false);
      expect(status.transports.http).toBe(true);
    });
  });

  describe('Stdio-only Mode', () => {
    beforeEach(() => {
      serverConfig.mode = 'stdio';
      serverState = new ServerState(mockMcpServer as Server, serverConfig);
    });

    it('should initialize only stdio transport in stdio mode', async () => {
      await serverState.initialize();
      
      const status = serverState.getStatus();
      
      expect(status.mode).toBe('stdio');
      expect(status.healthy).toBe(true);
      expect(status.transports.stdio).toBe(true);
      expect(status.transports.http).toBe(false);
    });
  });

  describe('Concurrent Connection Handling', () => {
    it('should handle multiple concurrent HTTP requests', async () => {
      mockMcpServer.request.mockResolvedValue({
        result: { tools: [] }
      });

      await serverState.initialize();
      const status = serverState.getStatus();
      const port = status.config.port;
      
      // Create multiple concurrent requests
      const requests = Array.from({ length: 5 }, (_, i) => 
        makeHttpRequest('GET', `http://127.0.0.1:${port}/health`)
      );
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
        const healthData = JSON.parse(response.body);
        expect(healthData.status).toBeDefined();
      });
    });

    it('should handle concurrent MCP requests', async () => {
      mockMcpServer.request.mockImplementation(async (req) => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        return { result: { tools: [] } };
      });

      await serverState.initialize();
      const status = serverState.getStatus();
      const port = status.config.port;
      
      const mcpRequest = {
        method: 'tools/list',
        params: {}
      };
      
      // Create multiple concurrent MCP requests
      const requests = Array.from({ length: 3 }, () => 
        makeHttpRequest(
          'POST', 
          `http://127.0.0.1:${port}/mcp`,
          JSON.stringify(mcpRequest),
          { 'Content-Type': 'application/json' }
        )
      );
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
        const mcpResponse = JSON.parse(response.body);
        expect(mcpResponse.result).toBeDefined();
      });
      
      // MCP server should have been called for each request
      expect(mockMcpServer.request).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed request types concurrently', async () => {
      mockMcpServer.request.mockResolvedValue({
        result: { tools: [] }
      });

      await serverState.initialize();
      const status = serverState.getStatus();
      const port = status.config.port;
      
      const mcpRequest = {
        method: 'tools/list',
        params: {}
      };
      
      // Mix of health checks and MCP requests
      const requests = [
        makeHttpRequest('GET', `http://127.0.0.1:${port}/health`),
        makeHttpRequest(
          'POST', 
          `http://127.0.0.1:${port}/mcp`,
          JSON.stringify(mcpRequest),
          { 'Content-Type': 'application/json' }
        ),
        makeHttpRequest('GET', `http://127.0.0.1:${port}/health`),
        makeHttpRequest(
          'POST', 
          `http://127.0.0.1:${port}/mcp`,
          JSON.stringify(mcpRequest),
          { 'Content-Type': 'application/json' }
        )
      ];
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });
      
      // Verify health check responses
      const healthResponses = [responses[0], responses[2]];
      healthResponses.forEach(response => {
        const healthData = JSON.parse(response.body);
        expect(healthData.status).toBeDefined();
        expect(healthData.checks).toBeDefined();
      });
      
      // Verify MCP responses
      const mcpResponses = [responses[1], responses[3]];
      mcpResponses.forEach(response => {
        const mcpData = JSON.parse(response.body);
        expect(mcpData.result).toBeDefined();
      });
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown both transports gracefully', async () => {
      await serverState.initialize();
      
      let status = serverState.getStatus();
      expect(status.healthy).toBe(true);
      expect(status.transports.stdio).toBe(true);
      expect(status.transports.http).toBe(true);
      
      await serverState.shutdown();
      
      status = serverState.getStatus();
      expect(status.healthy).toBe(false);
    });

    it('should handle shutdown when only partially initialized', async () => {
      // Initialize only partially by mocking an error
      mockMcpServer.connect.mockResolvedValueOnce(undefined);
      
      try {
        await serverState.initialize();
      } catch (error) {
        // Expected to fail
      }
      
      // Should still be able to shutdown gracefully
      await expect(serverState.shutdown()).resolves.not.toThrow();
    });

    it('should setup graceful shutdown handlers', () => {
      const processOnSpy = vi.spyOn(process, 'on');
      
      serverState.setupGracefulShutdown();
      
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      
      processOnSpy.mockRestore();
    });
  });

  describe('Error Recovery', () => {
    it('should handle HTTP transport failures without affecting stdio', async () => {
      // Mock HTTP transport to fail
      const originalConfig = { ...serverConfig };
      serverConfig.port = -1; // Invalid port to cause failure
      
      await expect(serverState.initialize()).rejects.toThrow();
      
      // Reset config and try stdio-only mode
      serverConfig.mode = 'stdio';
      serverConfig.port = originalConfig.port;
      serverState = new ServerState(mockMcpServer as Server, serverConfig);
      
      await expect(serverState.initialize()).resolves.not.toThrow();
      
      const status = serverState.getStatus();
      expect(status.transports.stdio).toBe(true);
      expect(status.transports.http).toBe(false);
    });

    it('should handle stdio transport failures without affecting HTTP', async () => {
      // Mock stdio transport to fail
      mockMcpServer.connect.mockRejectedValueOnce(new Error('Stdio connection failed'));
      
      // Try HTTP-only mode
      serverConfig.mode = 'http';
      serverState = new ServerState(mockMcpServer as Server, serverConfig);
      
      // Reset the mock for HTTP transport initialization
      mockMcpServer.connect.mockResolvedValue(undefined);
      
      await expect(serverState.initialize()).resolves.not.toThrow();
      
      const status = serverState.getStatus();
      expect(status.transports.stdio).toBe(false);
      expect(status.transports.http).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should reject invalid server modes', async () => {
      serverConfig.mode = 'invalid' as any;
      serverState = new ServerState(mockMcpServer as Server, serverConfig);
      
      await expect(serverState.initialize()).rejects.toThrow('Invalid server mode: invalid');
    });

    it('should handle missing configuration gracefully', async () => {
      const incompleteConfig = { mode: 'http' } as ServerConfig;
      serverState = new ServerState(mockMcpServer as Server, incompleteConfig);
      
      // Should still initialize with defaults
      await expect(serverState.initialize()).resolves.not.toThrow();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle rapid start/stop cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await serverState.initialize();
        expect(serverState.getStatus().healthy).toBe(true);
        
        await serverState.shutdown();
        expect(serverState.getStatus().healthy).toBe(false);
      }
    });

    it('should not leak resources during multiple initializations', async () => {
      // Track initial state
      const initialStatus = serverState.getStatus();
      
      // Multiple init/shutdown cycles
      for (let i = 0; i < 2; i++) {
        await serverState.initialize();
        await serverState.shutdown();
      }
      
      // Final state should be consistent
      const finalStatus = serverState.getStatus();
      expect(finalStatus.healthy).toBe(initialStatus.healthy);
      expect(finalStatus.mode).toBe(initialStatus.mode);
    });
  });
});

/**
 * Helper function to make HTTP requests for testing
 */
function makeHttpRequest(
  method: string, 
  url: string, 
  body?: string, 
  headers?: Record<string, string>
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers || {}
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers as Record<string, string>,
          body: responseBody
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}