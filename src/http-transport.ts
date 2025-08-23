/**
 * HTTP transport implementation for MCP server
 * Wraps the existing MCP server functionality to work over HTTP
 */

import http from "http";
import { URL } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    bindToOptimalNetwork,
    logNetworkConfiguration,
    detectNetworkStack,
    handleNetworkBindingError,
} from "./network-utils.js";
import { createNetworkConfig, getMergedCORSOrigins, ServerConfig } from "./config.js";
import { createCORSMiddleware } from "./cors-middleware.js";

interface BindResult {
    success: boolean;
    server?: http.Server;
    address?: string;
    port?: number;
    family?: string;
    error?: Error;
}

interface CORSMiddleware {
    handlePreflightRequest(req: http.IncomingMessage, res: http.ServerResponse): boolean;
    setCORSHeaders(req: http.IncomingMessage, res: http.ServerResponse): { allowed: boolean; reason?: string };
    getConfig(): any;
    validateOrigins(origins: string[]): { allowed: string[]; rejected: string[] };
    updateConfig(config: { origins: string[] }): void;
}

/**
 * HTTP Server Transport class that wraps MCP server functionality
 */
export class HttpServerTransport {
    private mcpServer: Server;
    private config: ServerConfig;
    private httpServer: http.Server | null = null;
    public isRunning: boolean = false;
    private corsMiddleware: CORSMiddleware;
    private bindResult?: BindResult;

    constructor(server: Server, config: ServerConfig) {
        this.mcpServer = server;
        this.config = config;

        // Initialize CORS middleware with merged origins (configured + private network)
        const mergedOrigins = getMergedCORSOrigins(config);
        this.corsMiddleware = createCORSMiddleware(mergedOrigins);

        console.log(`CORS middleware initialized with ${mergedOrigins.length} allowed origin patterns`);
        if (process.env.NODE_ENV === "development") {
            console.log("Allowed CORS origins:", mergedOrigins);
        }
    }

    /**
     * Starts the HTTP server with IPv6 dual-stack support
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error("HTTP transport is already running");
        }

        try {
            // Create network configuration
            const networkConfig = createNetworkConfig(this.config);

            // Detect available network stacks
            const stackInfo = await detectNetworkStack();

            // Create server factory function
            const createServerFn = () => {
                return http.createServer((req, res) => {
                    this.handleRequest(req, res);
                });
            };

            // Attempt to bind to optimal network configuration
            const bindResult = await bindToOptimalNetwork(networkConfig, createServerFn);

            if (!bindResult.success) {
                const enhancedError = handleNetworkBindingError(
                    bindResult.error || new Error("Unknown network binding error"),
                    networkConfig,
                    stackInfo,
                );
                console.error("Network binding failed with detailed diagnostics");
                throw enhancedError;
            }

            // Store the server instance
            this.httpServer = bindResult.server!;

            // Log network configuration for debugging
            logNetworkConfiguration(bindResult, networkConfig, stackInfo);

            this.isRunning = true;
            this.bindResult = bindResult;

            console.log(
                `HTTP transport successfully bound to ${bindResult.address}:${bindResult.port} (${bindResult.family})`,
            );
        } catch (error) {
            console.error("Failed to start HTTP transport:", error);
            throw error;
        }
    }

    /**
     * Stops the HTTP server
     */
    async stop(): Promise<void> {
        if (!this.isRunning || !this.httpServer) {
            return;
        }

        return new Promise((resolve) => {
            this.httpServer!.close(() => {
                this.isRunning = false;
                console.log("HTTP transport stopped");
                resolve();
            });
        });
    }

    /**
     * Handles incoming HTTP requests
     */
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // Handle CORS preflight requests first
        if (this.corsMiddleware.handlePreflightRequest(req, res)) {
            return;
        }

        // Set CORS headers for all requests
        const corsValidation = this.corsMiddleware.setCORSHeaders(req, res);

        // For security-sensitive endpoints, enforce CORS validation
        const origin = req.headers.origin;
        const isSecureEndpoint = req.url && (req.url.startsWith("/mcp") || req.url.includes("auth"));

        if (isSecureEndpoint && origin && !corsValidation.allowed) {
            console.warn(`CORS validation failed for secure endpoint ${req.url}:`, corsValidation.reason);
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    error: "CORS policy violation",
                    message: "Origin not allowed for this endpoint",
                }),
            );
            return;
        }

        // Parse URL to determine endpoint
        const url = new URL(req.url!, `http://${req.headers.host}`);

        if (url.pathname === "/health") {
            // Health check allows GET requests
            if (req.method !== "GET" && req.method !== "POST") {
                res.writeHead(405, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Method not allowed for health check" }));
                return;
            }
            await this.handleHealthCheck(req, res);
        } else if (url.pathname === "/mcp") {
            // MCP protocol requires POST requests
            if (req.method !== "POST") {
                res.writeHead(405, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Method not allowed. Use POST for MCP requests." }));
                return;
            }
            await this.handleMcpRequest(req, res);
        } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Endpoint not found" }));
        }
    }

    /**
     * Handles MCP protocol requests over HTTP
     */
    private async handleMcpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            // Read request body
            const body = await this.readRequestBody(req);

            // Parse JSON request
            let mcpRequest: any;
            try {
                mcpRequest = JSON.parse(body);
            } catch (error) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid JSON in request body" }));
                return;
            }

            // Validate MCP request structure (params not required for initialize)
            if (!mcpRequest.method) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid MCP request format: missing method" }));
                return;
            }

            // Ensure id is present for proper JSON-RPC response
            if (mcpRequest.id === undefined) {
                mcpRequest.id = null;
            }

            // Process the request through the MCP server
            const mcpResponse = await this.processMcpRequest(mcpRequest);

            // Send response
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(mcpResponse));
        } catch (error: any) {
            console.error("Error handling MCP request:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    error: "Internal server error",
                    message: error.message,
                }),
            );
        }
    }

    /**
     * Processes MCP requests by routing them to the appropriate server handlers
     */
    private async processMcpRequest(request: any): Promise<any> {
        try {
            // Route the request based on method
            switch (request.method) {
                case "initialize":
                    // Handle MCP initialization
                    return {
                        jsonrpc: "2.0",
                        id: request.id,
                        result: {
                            protocolVersion: "2024-11-05",
                            capabilities: {
                                tools: {},
                            },
                            serverInfo: {
                                name: "mcp-server-gmail",
                                version: "1.0.0",
                            },
                        },
                    };

                case "tools/list":
                    return await (this.mcpServer as any).request(
                        { method: "tools/list", params: request.params },
                        { method: "tools/list", params: request.params },
                    );

                case "tools/call":
                    return await (this.mcpServer as any).request(
                        { method: "tools/call", params: request.params },
                        { method: "tools/call", params: request.params },
                    );

                default:
                    return {
                        jsonrpc: "2.0",
                        id: request.id,
                        error: {
                            code: -32601,
                            message: `Method not found: ${request.method}`,
                        },
                    };
            }
        } catch (error: any) {
            return {
                error: {
                    code: -32603,
                    message: "Internal error",
                    data: error.message,
                },
            };
        }
    }

    /**
     * Handles health check requests
     */
    private async handleHealthCheck(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const healthStatus = await this.getHealthStatus();

        const statusCode = healthStatus.status === "healthy" ? 200 : 503;
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(healthStatus));
    }

    /**
     * Gets comprehensive health status including Gmail API connectivity
     */
    private async getHealthStatus(): Promise<any> {
        const timestamp = new Date().toISOString();
        let overallStatus = "healthy";
        const checks: any = {};

        // Server status
        checks.server = {
            status: "healthy",
            mode: this.config.mode,
            port: this.bindResult?.port || this.config.port,
            address: this.bindResult?.address || "unknown",
            family: this.bindResult?.family || "unknown",
            ipv6: this.config.enableIPv6,
            dualStack: this.bindResult?.family === "IPv6" && this.bindResult?.address === "::",
        };

        // MCP server status
        checks.mcp = {
            status: !!this.mcpServer ? "healthy" : "unhealthy",
            available: !!this.mcpServer,
            transport: "http",
        };

        // Gmail API connectivity check
        checks.gmail = await this.checkGmailConnectivity();

        // Credential status check
        checks.credentials = await this.checkCredentialStatus();

        // Network health check
        checks.network = await this.checkNetworkHealth();

        // CORS configuration check
        checks.cors = this.checkCORSConfiguration();

        // Determine overall status
        const allChecks = Object.values(checks);
        if (allChecks.some((check: any) => check.status === "unhealthy")) {
            overallStatus = "unhealthy";
        } else if (allChecks.some((check: any) => check.status === "degraded")) {
            overallStatus = "degraded";
        }

        return {
            status: overallStatus,
            timestamp,
            checks,
        };
    }

    /**
     * Checks network configuration health
     */
    private async checkNetworkHealth(): Promise<any> {
        try {
            const stackInfo = await detectNetworkStack();

            return {
                status: "healthy",
                details: {
                    ipv4Available: stackInfo.ipv4Available,
                    ipv6Available: stackInfo.ipv6Available,
                    preferredStack: stackInfo.preferredStack,
                    currentBinding: this.bindResult
                        ? {
                              address: this.bindResult.address,
                              port: this.bindResult.port,
                              family: this.bindResult.family,
                          }
                        : null,
                },
            };
        } catch (error: any) {
            return {
                status: "unhealthy",
                error: error.message,
            };
        }
    }

    /**
     * Checks Gmail API connectivity
     */
    private async checkGmailConnectivity(): Promise<any> {
        try {
            // This is a basic check - in a real implementation, you'd want to
            // make a lightweight API call to verify connectivity
            // For now, we'll just check if the oauth2Client is available

            // Import path and fs to check for credentials
            const fs = await import("fs");
            const path = await import("path");
            const os = await import("os");

            const CONFIG_DIR = path.join(os.homedir(), ".gmail-mcp");
            const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || path.join(CONFIG_DIR, "credentials.json");

            if (fs.existsSync(CREDENTIALS_PATH)) {
                return {
                    status: "healthy",
                    message: "Gmail credentials available",
                };
            } else {
                return {
                    status: "degraded",
                    message: "Gmail credentials not found, authentication may be required",
                };
            }
        } catch (error: any) {
            return {
                status: "unhealthy",
                message: `Gmail connectivity check failed: ${error.message}`,
            };
        }
    }

    /**
     * Checks credential status
     */
    private async checkCredentialStatus(): Promise<any> {
        try {
            // Import path and fs to check for OAuth keys
            const fs = await import("fs");
            const path = await import("path");
            const os = await import("os");

            const CONFIG_DIR = path.join(os.homedir(), ".gmail-mcp");
            const OAUTH_PATH = process.env.GMAIL_OAUTH_PATH || path.join(CONFIG_DIR, "gcp-oauth.keys.json");

            const hasOAuthKeys = fs.existsSync(OAUTH_PATH);
            const hasCredentials = fs.existsSync(
                process.env.GMAIL_CREDENTIALS_PATH || path.join(CONFIG_DIR, "credentials.json"),
            );

            if (hasOAuthKeys && hasCredentials) {
                return {
                    status: "healthy",
                    message: "All credentials available",
                };
            } else if (hasOAuthKeys) {
                return {
                    status: "degraded",
                    message: "OAuth keys available, user credentials missing",
                };
            } else {
                return {
                    status: "unhealthy",
                    message: "OAuth keys missing",
                };
            }
        } catch (error: any) {
            return {
                status: "unhealthy",
                message: `Credential check failed: ${error.message}`,
            };
        }
    }

    /**
     * Checks CORS configuration health
     */
    private checkCORSConfiguration(): any {
        try {
            const corsConfig = this.corsMiddleware.getConfig();
            const originCount = corsConfig.origins.length;

            // Test a few common private network origins
            const testOrigins = [
                "http://localhost:3000",
                "http://192.168.1.100:8080",
                "http://10.0.0.1:3000",
                "https://myapp.railway.app",
            ];

            const validationResults = this.corsMiddleware.validateOrigins(testOrigins);

            return {
                status: originCount > 0 ? "healthy" : "degraded",
                details: {
                    configuredOrigins: originCount,
                    allowedMethods: corsConfig.methods,
                    allowedHeaders: corsConfig.allowedHeaders.length,
                    maxAge: corsConfig.maxAge,
                    testResults: {
                        tested: testOrigins.length,
                        allowed: validationResults.allowed.length,
                        rejected: validationResults.rejected.length,
                    },
                },
            };
        } catch (error: any) {
            return {
                status: "unhealthy",
                error: error.message,
            };
        }
    }

    /**
     * Gets the CORS middleware instance for external access
     */
    getCORSMiddleware(): CORSMiddleware {
        return this.corsMiddleware;
    }

    /**
     * Updates CORS configuration at runtime
     */
    updateCORSConfig(newOrigins: string[]): void {
        if (newOrigins && Array.isArray(newOrigins)) {
            this.corsMiddleware.updateConfig({ origins: newOrigins });
            console.log("CORS configuration updated with new origins:", newOrigins);
        }
    }

    /**
     * Reads the request body from an HTTP request
     */
    private readRequestBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = "";

            req.on("data", (chunk) => {
                body += chunk.toString();
            });

            req.on("end", () => {
                resolve(body);
            });

            req.on("error", (error) => {
                reject(error);
            });
        });
    }
}
