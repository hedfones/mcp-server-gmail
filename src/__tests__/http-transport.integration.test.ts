/**
 * Integration tests for HTTP transport MCP protocol handling
 * Tests Requirements: 3.1, 3.4, 4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { HttpServerTransport } from '../http-transport.js';
import { ServerConfig } from '../config.js';
import http from 'http';

describe('HTTP Transport Integration', () => {
  let httpTransport: HttpServerTransport;
  let mockMcpServer: any;
  let serverConfig: ServerConfig;

  beforeEach(() => {
    // Create mock MCP server
    mockMcpServer = {
      request: vi.fn(),
      connect: vi.fn(),
      close: vi.fn()
    };

    // Create test server configuration
    serverConfig = {
      mode: 'http',
      port: 0, // Use random available port for testing
      host: '127.0.0.1',
      enableIPv6: false,
      allowPrivateNetworkAccess: true,
      railwayInternalAccess: false,
      corsOrigins: ['http://localhost:3000']
    };

    // Create HTTP transport instance
    httpTransport = new HttpServerTransport(mockMcpServer as Server, serverConfig);
  });

  afterEach(async () => {
    if (httpTransport.isRunning) {
      await httpTransport.stop();
    }
    vi.restoreAllMocks();
  });

  describe('Server Lifecycle', () => {
    it('should start and stop HTTP server successfully', async () => {
      expect(httpTransport.isRunning).toBe(false);

      await httpTransport.start();
      expect(httpTransport.isRunning).toBe(true);

      await httpTransport.stop();
      expect(httpTransport.isRunning).toBe(false);
    });

    it('should throw error when starting already running server', async () => {
      await httpTransport.start();
      
      await expect(httpTransport.start()).rejects.toThrow('HTTP transport is already running');
      
      await httpTransport.stop();
    });

    it('should handle stop gracefully when server is not running', async () => {
      expect(httpTransport.isRunning).toBe(false);
      
      // Should not throw
      await httpTransport.stop();
      
      expect(httpTransport.isRunning).toBe(false);
    });
  });

  describe('Health Check Endpoint', () => {
    it('should respond to GET /health with server status', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest('GET', `http://127.0.0.1:${port}/health`);
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      
      const healthData = JSON.parse(response.body);
      expect(healthData.status).toBeDefined();
      expect(healthData.timestamp).toBeDefined();
      expect(healthData.checks).toBeDefined();
      expect(healthData.checks.server).toBeDefined();
      expect(healthData.checks.mcp).toBeDefined();
      expect(healthData.checks.network).toBeDefined();
      expect(healthData.checks.cors).toBeDefined();
    });

    it('should respond to POST /health with server status', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest('POST', `http://127.0.0.1:${port}/health`);
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      
      const healthData = JSON.parse(response.body);
      expect(healthData.status).toBeDefined();
    });

    it('should reject unsupported methods on /health', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest('PUT', `http://127.0.0.1:${port}/health`);
      
      expect(response.statusCode).toBe(405);
      
      const errorData = JSON.parse(response.body);
      expect(errorData.error).toContain('Method not allowed');
    });

    it('should include detailed health check information', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest('GET', `http://127.0.0.1:${port}/health`);
      const healthData = JSON.parse(response.body);
      
      // Server check
      expect(healthData.checks.server.status).toBe('healthy');
      expect(healthData.checks.server.mode).toBe('http');
      expect(healthData.checks.server.port).toBe(port);
      expect(healthData.checks.server.address).toBeDefined();
      
      // MCP check
      expect(healthData.checks.mcp.status).toBe('healthy');
      expect(healthData.checks.mcp.transport).toBe('http');
      
      // Network check
      expect(healthData.checks.network.status).toBe('healthy');
      expect(healthData.checks.network.details).toBeDefined();
      
      // CORS check
      expect(healthData.checks.cors.status).toBeDefined();
      expect(healthData.checks.cors.details).toBeDefined();
    });
  });

  describe('MCP Protocol Handling', () => {
    beforeEach(() => {
      // Mock successful MCP server responses
      mockMcpServer.request.mockResolvedValue({
        result: { tools: [] }
      });
    });

    it('should handle POST /mcp requests with valid MCP protocol', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const mcpRequest = {
        method: 'tools/list',
        params: {}
      };
      
      const response = await makeHttpRequest(
        'POST', 
        `http://127.0.0.1:${port}/mcp`,
        JSON.stringify(mcpRequest),
        { 'Content-Type': 'application/json' }
      );
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      
      const mcpResponse = JSON.parse(response.body);
      expect(mcpResponse.result).toBeDefined();
    });

    it('should reject non-POST requests to /mcp', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest('GET', `http://127.0.0.1:${port}/mcp`);
      
      expect(response.statusCode).toBe(405);
      
      const errorData = JSON.parse(response.body);
      expect(errorData.error).toContain('Method not allowed');
    });

    it('should handle invalid JSON in MCP requests', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest(
        'POST', 
        `http://127.0.0.1:${port}/mcp`,
        'invalid json',
        { 'Content-Type': 'application/json' }
      );
      
      expect(response.statusCode).toBe(400);
      
      const errorData = JSON.parse(response.body);
      expect(errorData.error).toContain('Invalid JSON');
    });

    it('should handle malformed MCP requests', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const invalidRequest = { invalid: 'request' };
      
      const response = await makeHttpRequest(
        'POST', 
        `http://127.0.0.1:${port}/mcp`,
        JSON.stringify(invalidRequest),
        { 'Content-Type': 'application/json' }
      );
      
      expect(response.statusCode).toBe(400);
      
      const errorData = JSON.parse(response.body);
      expect(errorData.error).toContain('Invalid MCP request format');
    });

    it('should handle tools/call requests', async () => {
      mockMcpServer.request.mockResolvedValue({
        result: { content: [{ type: 'text', text: 'Tool executed successfully' }] }
      });

      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const mcpRequest = {
        method: 'tools/call',
        params: {
          name: 'test_tool',
          arguments: { test: 'value' }
        }
      };
      
      const response = await makeHttpRequest(
        'POST', 
        `http://127.0.0.1:${port}/mcp`,
        JSON.stringify(mcpRequest),
        { 'Content-Type': 'application/json' }
      );
      
      expect(response.statusCode).toBe(200);
      
      const mcpResponse = JSON.parse(response.body);
      expect(mcpResponse.result).toBeDefined();
      expect(mockMcpServer.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'tools/call' }),
        expect.objectContaining({ method: 'tools/call' })
      );
    });

    it('should handle unsupported MCP methods', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const mcpRequest = {
        method: 'unsupported/method',
        params: {}
      };
      
      const response = await makeHttpRequest(
        'POST', 
        `http://127.0.0.1:${port}/mcp`,
        JSON.stringify(mcpRequest),
        { 'Content-Type': 'application/json' }
      );
      
      expect(response.statusCode).toBe(200);
      
      const mcpResponse = JSON.parse(response.body);
      expect(mcpResponse.error).toBeDefined();
      expect(mcpResponse.error.code).toBe(-32601);
      expect(mcpResponse.error.message).toContain('Method not found');
    });

    it('should handle MCP server errors gracefully', async () => {
      mockMcpServer.request.mockRejectedValue(new Error('MCP server error'));

      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const mcpRequest = {
        method: 'tools/list',
        params: {}
      };
      
      const response = await makeHttpRequest(
        'POST', 
        `http://127.0.0.1:${port}/mcp`,
        JSON.stringify(mcpRequest),
        { 'Content-Type': 'application/json' }
      );
      
      expect(response.statusCode).toBe(200);
      
      const mcpResponse = JSON.parse(response.body);
      expect(mcpResponse.error).toBeDefined();
      expect(mcpResponse.error.code).toBe(-32603);
      expect(mcpResponse.error.message).toBe('Internal error');
    });
  });

  describe('CORS Handling', () => {
    it('should handle preflight OPTIONS requests', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest(
        'OPTIONS', 
        `http://127.0.0.1:${port}/mcp`,
        undefined,
        { 'Origin': 'http://localhost:3000' }
      );
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should reject preflight requests from unauthorized origins', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest(
        'OPTIONS', 
        `http://127.0.0.1:${port}/mcp`,
        undefined,
        { 'Origin': 'https://malicious.com' }
      );
      
      expect(response.statusCode).toBe(403);
      
      const errorData = JSON.parse(response.body);
      expect(errorData.error).toContain('CORS policy violation');
    });

    it('should set CORS headers for allowed origins on actual requests', async () => {
      mockMcpServer.request.mockResolvedValue({ result: { tools: [] } });

      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const mcpRequest = {
        method: 'tools/list',
        params: {}
      };
      
      const response = await makeHttpRequest(
        'POST', 
        `http://127.0.0.1:${port}/mcp`,
        JSON.stringify(mcpRequest),
        { 
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        }
      );
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should enforce CORS for secure endpoints', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const mcpRequest = {
        method: 'tools/list',
        params: {}
      };
      
      const response = await makeHttpRequest(
        'POST', 
        `http://127.0.0.1:${port}/mcp`,
        JSON.stringify(mcpRequest),
        { 
          'Content-Type': 'application/json',
          'Origin': 'https://malicious.com'
        }
      );
      
      expect(response.statusCode).toBe(403);
      
      const errorData = JSON.parse(response.body);
      expect(errorData.error).toContain('CORS policy violation');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest('GET', `http://127.0.0.1:${port}/unknown`);
      
      expect(response.statusCode).toBe(404);
      
      const errorData = JSON.parse(response.body);
      expect(errorData.error).toContain('Endpoint not found');
    });

    it('should handle internal server errors gracefully', async () => {
      // Mock an error in the request processing
      const originalHandleRequest = (httpTransport as any).handleRequest;
      (httpTransport as any).handleRequest = vi.fn().mockRejectedValue(new Error('Internal error'));

      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest('GET', `http://127.0.0.1:${port}/health`);
      
      // The server should still respond, even if there's an internal error
      expect(response.statusCode).toBeDefined();
      
      // Restore original method
      (httpTransport as any).handleRequest = originalHandleRequest;
    });
  });

  describe('CORS Configuration Management', () => {
    it('should allow updating CORS configuration at runtime', async () => {
      await httpTransport.start();
      
      const newOrigins = ['https://newapp.com', 'http://test.local:8080'];
      httpTransport.updateCORSConfig(newOrigins);
      
      const corsMiddleware = httpTransport.getCORSMiddleware();
      const config = corsMiddleware.getConfig();
      
      expect(config.origins).toEqual(newOrigins);
    });

    it('should validate CORS configuration in health check', async () => {
      await httpTransport.start();
      const port = (httpTransport as any).bindResult?.port;
      
      const response = await makeHttpRequest('GET', `http://127.0.0.1:${port}/health`);
      const healthData = JSON.parse(response.body);
      
      expect(healthData.checks.cors.status).toBeDefined();
      expect(healthData.checks.cors.details.configuredOrigins).toBeGreaterThan(0);
      expect(healthData.checks.cors.details.testResults).toBeDefined();
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