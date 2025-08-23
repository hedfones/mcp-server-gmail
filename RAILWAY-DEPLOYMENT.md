# Railway Deployment Guide

This guide explains how to deploy your Gmail MCP server to Railway with persistent credential storage.

## Prerequisites

1. **Local Authentication**: Complete the OAuth flow locally first:
   ```bash
   npm run auth
   ```
   This creates the necessary credential files in `~/.gmail-mcp/`

2. **Railway CLI**: Install and authenticate with Railway:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

## Deployment Options

### Option 1: Volume-Based Storage (Recommended)

This approach stores your credentials in a persistent Railway volume, which is more secure and easier to manage.

#### Step 1: Create Railway Project
```bash
railway init
railway link  # Link to existing project or create new one
```

#### Step 2: Create Volume
```bash
railway volume create gmail-credentials
```

#### Step 3: Upload Credentials

There are two ways to get your credentials into the Railway volume:

**Method A: Via Railway Dashboard (Recommended)**
1. Go to your Railway project dashboard
2. Navigate to the "Volumes" tab
3. Click on your `gmail-credentials` volume
4. Use the file upload interface to upload:
   - `gcp-oauth.keys.json` (from `~/.gmail-mcp/`)
   - `credentials.json` (from `~/.gmail-mcp/`)

**Method B: Deploy with Credentials in Container**
```bash
# Copy credentials to your project directory temporarily
mkdir -p credentials
cp ~/.gmail-mcp/gcp-oauth.keys.json credentials/
cp ~/.gmail-mcp/credentials.json credentials/

# Deploy (the volume will persist these files)
railway up

# Clean up local copies
rm -rf credentials
```

#### Step 4: Deploy
```bash
railway up
```

Your `railway.toml` is already configured to mount the volume at `/app/credentials/`.

### Option 2: Environment Variables

If you prefer environment variables over volumes:

#### Step 1: Extract Credentials
```bash
# Run the setup helper to get the exact values
npm run setup:railway
```

#### Step 2: Set Environment Variables
In your Railway dashboard or via CLI:
```bash
railway variables set GMAIL_CLIENT_ID="your_client_id"
railway variables set GMAIL_CLIENT_SECRET="your_client_secret" 
railway variables set GMAIL_REFRESH_TOKEN="your_refresh_token"
```

#### Step 3: Deploy
```bash
railway up
```

## Configuration

### Environment Variables

The server automatically detects Railway environment and configures itself appropriately:

- **PORT**: Automatically set by Railway
- **RAILWAY_ENVIRONMENT**: Set by Railway
- **MCP_SERVER_MODE**: Defaults to 'http' on Railway
- **CORS_ORIGINS**: Configure if needed for specific client access

### Volume Configuration

The `railway.toml` includes volume configuration:
```toml
[[deploy.volumes]]
name = "gmail-credentials"
mountPath = "/app/credentials"
```

### Health Checks

Railway health checks are configured at `/health` endpoint with:
- 30-second intervals
- 10-second timeout
- 5-second startup period
- 3 retry attempts

## Verification

After deployment, verify your server is working:

1. **Check Health**: Visit `https://your-app.railway.app/health`
2. **Test MCP Connection**: Use your Railway URL in your MCP client configuration
3. **Monitor Logs**: Use `railway logs` to monitor server activity

## Troubleshooting

### Common Issues

1. **Credentials Not Found**
   - Verify volume is properly mounted
   - Check file permissions in volume
   - Ensure credential files are valid JSON

2. **OAuth Errors**
   - Verify client ID and secret are correct
   - Check refresh token is still valid
   - Ensure redirect URIs match your configuration

3. **Health Check Failures**
   - Check server is binding to correct port (`process.env.PORT`)
   - Verify `/health` endpoint is accessible
   - Monitor startup logs for errors

### Debug Commands

```bash
# View logs
railway logs

# Check environment variables
railway variables

# List volumes
railway volume list

# Check volume details
railway volume list --json

# Connect to running container
railway shell

# Check if files exist in volume (from within container)
ls -la /app/credentials/
```

## Security Considerations

1. **Volume Security**: Railway volumes are encrypted and isolated per project
2. **Environment Variables**: Stored securely in Railway's infrastructure
3. **Network Access**: Configure CORS origins appropriately for your use case
4. **Token Refresh**: The server automatically refreshes OAuth tokens as needed

## Updating Credentials

### For Volume-Based Storage
1. Mount the volume locally
2. Replace the credential files
3. Restart the deployment

### For Environment Variables
```bash
railway variables set GMAIL_REFRESH_TOKEN="new_refresh_token"
```

## Cost Optimization

The current configuration uses:
- **CPU**: 4 vCPU limit
- **Memory**: 4GB limit
- **Volume**: Persistent storage for credentials

Adjust these limits in `railway.toml` based on your usage patterns.