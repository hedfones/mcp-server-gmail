# CORS Configuration Guide

This document explains how to configure Cross-Origin Resource Sharing (CORS) for the Gmail MCP server when deployed on Railway or other remote environments.

## Overview

The server includes comprehensive CORS support to allow secure access from private network clients while blocking unauthorized external access.

## Default Configuration

By default, the server allows requests from:

### Private Network Ranges (RFC 1918)
- `10.0.0.0/8` (10.x.x.x)
- `172.16.0.0/12` (172.16.x.x - 172.31.x.x)
- `192.168.0.0/16` (192.168.x.x)

### Localhost and Loopback
- `localhost` (all ports)
- `127.0.0.1` (all ports)
- `::1` (IPv6 localhost)

### Railway Platform
- `*.railway.app`
- `*.up.railway.app`
- `*.railway.internal`

## Environment Variables

Configure CORS behavior using these environment variables:

### `CORS_ORIGINS`
Comma-separated list of additional allowed origins:
```bash
CORS_ORIGINS="https://myapp.example.com,http://custom-client:8080"
```

### `ALLOW_PRIVATE_NETWORK_ACCESS`
Enable/disable private network access (default: true on Railway):
```bash
ALLOW_PRIVATE_NETWORK_ACCESS=true
```

### `RAILWAY_INTERNAL_ACCESS`
Enable/disable Railway internal network access (default: true on Railway):
```bash
RAILWAY_INTERNAL_ACCESS=true
```

## Security Features

### Origin Validation
- Strict pattern matching against allowed origins
- Wildcard support for IP ranges and subdomains
- Private network detection and validation

### Request Filtering
- Preflight OPTIONS request handling
- Secure endpoint protection (MCP and auth endpoints)
- Detailed error responses for debugging

### Monitoring
- CORS validation logging
- Health check endpoint includes CORS status
- Batch origin validation for testing

## Example Configurations

### Development (Local)
```bash
MCP_SERVER_MODE=http
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:8080"
ALLOW_PRIVATE_NETWORK_ACCESS=true
```

### Production (Railway)
```bash
# Railway automatically sets these
RAILWAY_ENVIRONMENT=production
PORT=3000

# Custom configuration
CORS_ORIGINS="https://my-frontend.railway.app"
ALLOW_PRIVATE_NETWORK_ACCESS=true
RAILWAY_INTERNAL_ACCESS=true
```

### Restricted Access
```bash
# Only allow specific origins
CORS_ORIGINS="https://trusted-client.com"
ALLOW_PRIVATE_NETWORK_ACCESS=false
RAILWAY_INTERNAL_ACCESS=false
```

## Testing CORS Configuration

### Health Check Endpoint
Visit `/health` to see CORS configuration status:
```json
{
  "status": "healthy",
  "checks": {
    "cors": {
      "status": "healthy",
      "details": {
        "configuredOrigins": 25,
        "allowedMethods": ["GET", "POST", "OPTIONS"],
        "testResults": {
          "tested": 4,
          "allowed": 3,
          "rejected": 1
        }
      }
    }
  }
}
```

### Manual Testing
Use curl to test CORS headers:
```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: http://192.168.1.100:3000" \
  -H "Access-Control-Request-Method: POST" \
  https://your-app.railway.app/mcp

# Test actual request
curl -X POST \
  -H "Origin: http://192.168.1.100:3000" \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list","params":{}}' \
  https://your-app.railway.app/mcp
```

## Troubleshooting

### Common Issues

1. **Origin Rejected**
   - Check if origin matches allowed patterns
   - Verify private network configuration
   - Check server logs for detailed error messages

2. **Preflight Failures**
   - Ensure OPTIONS method is allowed
   - Check Access-Control-Request-Headers
   - Verify origin header is present

3. **Railway Deployment Issues**
   - Confirm Railway environment variables are set
   - Check internal network configuration
   - Verify Railway domain patterns

### Debug Mode
Enable detailed CORS logging:
```bash
NODE_ENV=development
```

This will log all CORS validation attempts and results.

## Security Considerations

- Never use `*` for Access-Control-Allow-Origin in production
- Regularly review and update allowed origins
- Monitor CORS validation logs for suspicious activity
- Use HTTPS origins when possible
- Consider implementing additional authentication for sensitive endpoints