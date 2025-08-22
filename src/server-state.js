/**
 * Server state management for dual transport architecture
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HttpServerTransport } from "./http-transport.js";

/**
 * Server state management class
 */
export class ServerState {
  constructor(mcpServer, config) {
    this.mcpServer = mcpServer;
    this.config = config;
    this.transports = {};
    this.isHealthy = false;
  }

  /**
   * Initializes the appropriate transports based on configuration
   */
  async initialize() {
    try {
      switch (this.config.mode) {
        case 'stdio':
          await this.initializeStdioTransport();
          break;
        
        case 'http':
          await this.initializeHttpTransport();
          break;
        
        case 'dual':
          await this.initializeStdioTransport();
          await this.initializeHttpTransport();
          break;
        
        default:
          throw new Error(`Invalid server mode: ${this.config.mode}`);
      }

      this.isHealthy = true;
      console.log(`Server initialized in ${this.config.mode} mode`);
    } catch (error) {
      console.error('Failed to initialize server:', error);
      throw error;
    }
  }

  /**
   * Initializes stdio transport
   */
  async initializeStdioTransport() {
    console.log('Initializing stdio transport...');
    this.transports.stdio = new StdioServerTransport();
    
    // Connect the MCP server to stdio transport
    await this.mcpServer.connect(this.transports.stdio);
    console.log('Stdio transport initialized');
  }

  /**
   * Initializes HTTP transport
   */
  async initializeHttpTransport() {
    console.log('Initializing HTTP transport...');
    this.transports.http = new HttpServerTransport(this.mcpServer, this.config);
    
    // Start the HTTP server
    await this.transports.http.start();
    console.log('HTTP transport initialized');
  }

  /**
   * Gracefully shuts down all transports
   */
  async shutdown() {
    console.log('Shutting down server...');
    
    // Stop HTTP transport if running
    if (this.transports.http) {
      await this.transports.http.stop();
    }

    // Stdio transport doesn't need explicit shutdown
    
    this.isHealthy = false;
    console.log('Server shutdown complete');
  }

  /**
   * Gets the current server status
   */
  getStatus() {
    return {
      mode: this.config.mode,
      healthy: this.isHealthy,
      transports: {
        stdio: !!this.transports.stdio,
        http: !!this.transports.http && this.transports.http.isRunning
      },
      config: {
        port: this.config.port,
        host: this.config.host,
        ipv6: this.config.enableIPv6,
        corsOrigins: this.config.corsOrigins
      }
    };
  }

  /**
   * Handles graceful shutdown on process signals
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}