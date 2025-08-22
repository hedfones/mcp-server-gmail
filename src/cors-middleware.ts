/**
 * CORS middleware for HTTP transport with private network origin validation
 */

import { IncomingMessage, ServerResponse } from 'http';

export interface CORSConfig {
  origins: string[];
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge?: number;
}

export interface CORSValidationResult {
  allowed: boolean;
  origin?: string;
  reason?: string;
}

/**
 * Default CORS configuration for private network access
 */
export const DEFAULT_CORS_CONFIG: CORSConfig = {
  origins: [
    // Private network ranges (RFC 1918)
    'http://10.*',
    'https://10.*',
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
    'http://192.168.*',
    'https://192.168.*',
    // Localhost and loopback
    'http://localhost:*',
    'https://localhost:*',
    'http://127.0.0.1:*',
    'https://127.0.0.1:*',
    // Railway internal network (Railway uses internal networking)
    'https://*.railway.app',
    'https://*.up.railway.app',
    // IPv6 localhost
    'http://[::1]:*',
    'https://[::1]:*'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: false,
  maxAge: 86400 // 24 hours
};

/**
 * CORS middleware class for handling cross-origin requests
 */
export class CORSMiddleware {
  private config: CORSConfig;

  constructor(config?: Partial<CORSConfig>) {
    this.config = {
      ...DEFAULT_CORS_CONFIG,
      ...config
    };
  }

  /**
   * Validates if an origin is allowed based on the configured patterns
   */
  validateOrigin(origin: string): CORSValidationResult {
    if (!origin) {
      return {
        allowed: false,
        reason: 'No origin header provided'
      };
    }

    // Check against each allowed origin pattern
    for (const allowedOrigin of this.config.origins) {
      if (this.matchesOriginPattern(origin, allowedOrigin)) {
        return {
          allowed: true,
          origin: origin
        };
      }
    }

    return {
      allowed: false,
      origin: origin,
      reason: `Origin ${origin} not in allowed list`
    };
  }

  /**
   * Matches an origin against a pattern (supports wildcards)
   */
  private matchesOriginPattern(origin: string, pattern: string): boolean {
    // Exact match
    if (origin === pattern) {
      return true;
    }

    // Wildcard pattern matching
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')  // Escape dots
        .replace(/\[/g, '\\[')  // Escape square brackets for IPv6
        .replace(/\]/g, '\\]')  // Escape square brackets for IPv6
        .replace(/:/g, ':')     // Keep colons as-is for IPv6
        .replace(/\*/g, '.*');  // Convert * to .*
      
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(origin);
    }

    return false;
  }

  /**
   * Checks if the origin is from a private network range
   */
  isPrivateNetworkOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      const hostname = url.hostname;

      // IPv4 private ranges
      if (this.isIPv4PrivateRange(hostname)) {
        return true;
      }

      // IPv6 private ranges (simplified check for local addresses)
      if (hostname.startsWith('[') && hostname.endsWith(']')) {
        const ipv6 = hostname.slice(1, -1);
        if (ipv6.startsWith('::1') || ipv6.startsWith('fc') || ipv6.startsWith('fd')) {
          return true;
        }
      }

      // Localhost variations
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Checks if an IP address is in IPv4 private ranges
   */
  private isIPv4PrivateRange(ip: string): boolean {
    const ipParts = ip.split('.').map(Number);
    
    if (ipParts.length !== 4 || ipParts.some(part => isNaN(part) || part < 0 || part > 255)) {
      return false;
    }

    const [a, b] = ipParts;

    // 10.0.0.0/8
    if (a === 10) {
      return true;
    }

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }

    // 192.168.0.0/16
    if (a === 192 && b === 168) {
      return true;
    }

    return false;
  }

  /**
   * Sets CORS headers on the response
   */
  setCORSHeaders(req: IncomingMessage, res: ServerResponse): CORSValidationResult {
    const origin = req.headers.origin as string;
    const validationResult = this.validateOrigin(origin);

    if (validationResult.allowed && validationResult.origin) {
      // Set specific origin if validated
      res.setHeader('Access-Control-Allow-Origin', validationResult.origin);
    } else {
      // For health checks and other non-CORS requests, we might want to be more permissive
      // But for security, we'll only allow validated origins
      res.setHeader('Access-Control-Allow-Origin', 'null');
    }

    // Set other CORS headers
    res.setHeader('Access-Control-Allow-Methods', this.config.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', this.config.allowedHeaders.join(', '));
    
    if (this.config.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    if (this.config.maxAge) {
      res.setHeader('Access-Control-Max-Age', this.config.maxAge.toString());
    }

    return validationResult;
  }

  /**
   * Handles preflight OPTIONS requests
   */
  handlePreflightRequest(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.method !== 'OPTIONS') {
      return false;
    }

    const validationResult = this.setCORSHeaders(req, res);
    
    if (!validationResult.allowed) {
      const origin = req.headers.origin as string;
      const isPrivateNetwork = origin ? this.isPrivateNetworkOrigin(origin) : false;
      
      console.warn(`CORS preflight rejected - Origin: ${origin}, Private Network: ${isPrivateNetwork}, Reason: ${validationResult.reason}`);
      
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'CORS policy violation',
        message: validationResult.reason || 'Origin not allowed',
        origin: origin,
        isPrivateNetwork: isPrivateNetwork,
        allowedPatterns: this.config.origins.slice(0, 5) // Show first 5 patterns for debugging
      }));
      return true;
    }

    console.log(`CORS preflight approved for origin: ${validationResult.origin}`);
    res.writeHead(200);
    res.end();
    return true;
  }

  /**
   * Middleware function that can be used with HTTP servers
   */
  middleware() {
    return (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
      // Handle preflight requests
      if (this.handlePreflightRequest(req, res)) {
        return;
      }

      // Set CORS headers for actual requests
      const validationResult = this.setCORSHeaders(req, res);
      
      // For non-preflight requests, we might want to allow the request to continue
      // even if CORS validation fails, but log it for security monitoring
      if (!validationResult.allowed) {
        console.warn(`CORS validation failed for origin: ${validationResult.origin}, reason: ${validationResult.reason}`);
      }

      if (next) {
        next();
      }
    };
  }

  /**
   * Updates the CORS configuration
   */
  updateConfig(newConfig: Partial<CORSConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }

  /**
   * Gets the current CORS configuration
   */
  getConfig(): CORSConfig {
    return { ...this.config };
  }

  /**
   * Validates multiple origins and returns a summary
   */
  validateOrigins(origins: string[]): { allowed: string[], rejected: string[], summary: any } {
    const allowed: string[] = [];
    const rejected: string[] = [];
    const privateNetworkCount = { allowed: 0, rejected: 0 };
    const railwayCount = { allowed: 0, rejected: 0 };

    for (const origin of origins) {
      const result = this.validateOrigin(origin);
      if (result.allowed) {
        allowed.push(origin);
        if (this.isPrivateNetworkOrigin(origin)) {
          privateNetworkCount.allowed++;
        }
        if (origin.includes('railway')) {
          railwayCount.allowed++;
        }
      } else {
        rejected.push(origin);
        if (this.isPrivateNetworkOrigin(origin)) {
          privateNetworkCount.rejected++;
        }
        if (origin.includes('railway')) {
          railwayCount.rejected++;
        }
      }
    }

    return {
      allowed,
      rejected,
      summary: {
        total: origins.length,
        allowedCount: allowed.length,
        rejectedCount: rejected.length,
        privateNetworkCount,
        railwayCount
      }
    };
  }
}

/**
 * Creates a CORS middleware instance with environment-based configuration
 */
export function createCORSMiddleware(envOrigins?: string[]): CORSMiddleware {
  const config: Partial<CORSConfig> = {};

  if (envOrigins && envOrigins.length > 0) {
    // Merge environment origins with defaults
    config.origins = [...DEFAULT_CORS_CONFIG.origins, ...envOrigins];
  }

  return new CORSMiddleware(config);
}