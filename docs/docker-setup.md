# Docker Setup Guide

This guide will help you run the Gmail AutoAuth MCP Server as a local Docker container.

## Prerequisites

1. **Docker installed and running**
2. **Gmail OAuth credentials** from Google Cloud Console

## Quick Setup (Automated)

Run the automated setup script:

```bash
./docker-setup.sh
```

This script will:
- Check for Docker and credentials
- Build the Docker image
- Run OAuth authentication
- Start the server container

## Manual Setup

### Step 1: Get Gmail OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project and enable Gmail API
3. Go to "APIs & Services" > "Credentials"
4. Create OAuth client ID (Web application)
5. Add `http://localhost:3000/oauth2callback` to redirect URIs
6. Download JSON file and save as `gcp-oauth.keys.json` in project root

### Step 2: Build Docker Image

```bash
docker build -t gmail-mcp-server .
```

### Step 3: Run Authentication

```bash
docker run -it --rm \
  --mount type=bind,source="$(pwd)/gcp-oauth.keys.json",target=/gcp-oauth.keys.json \
  -v mcp-gmail:/gmail-server \
  -e GMAIL_OAUTH_PATH=/gcp-oauth.keys.json \
  -e GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json \
  -p 3000:3000 \
  gmail-mcp-server auth
```

This will open your browser for Google authentication.

### Step 4: Start the Server

```bash
docker run -d \
  --name gmail-mcp-server \
  -v mcp-gmail:/gmail-server \
  -e GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json \
  -p 3000:3000 \
  --restart unless-stopped \
  gmail-mcp-server
```

## Docker Compose Setup

For easier management, use docker-compose:

```bash
# Build and start (first time)
docker-compose up -d --build

# For authentication (run once)
docker-compose run --rm gmail-mcp auth

# Start/stop the service
docker-compose up -d
docker-compose down
```

## Verify Setup

Test the server is running:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "server": {
    "status": "healthy"
  }
}
```

## Container Management

```bash
# View logs
docker logs gmail-mcp-server

# Stop server
docker stop gmail-mcp-server

# Start server
docker start gmail-mcp-server

# Remove container
docker rm -f gmail-mcp-server

# Remove volume (deletes stored credentials)
docker volume rm mcp-gmail
```

## Using with Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "mcp-gmail:/gmail-server",
        "-e",
        "GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json",
        "gmail-mcp-server"
      ]
    }
  }
}
```

## Troubleshooting

### "Endpoint not found" Error During Authentication

If you get `{"error":"Endpoint not found"}` when clicking the OAuth URL:

1. **Check port availability**:
   ```bash
   lsof -i :3000
   # Kill any processes using port 3000
   ```

2. **Verify OAuth redirect URI** in Google Cloud Console:
   - Must be exactly: `http://localhost:3000/oauth2callback`
   - Case sensitive and no trailing slash

3. **Use the authentication-only script**:
   ```bash
   ./docker-auth.sh
   ```

4. **Manual authentication troubleshooting**:
   ```bash
   # Stop any running containers
   docker stop gmail-mcp-server
   
   # Run auth with verbose logging
   docker run -it --rm \
     --mount type=bind,source="$(pwd)/gcp-oauth.keys.json",target=/gcp-oauth.keys.json \
     -v mcp-gmail:/gmail-server \
     -e GMAIL_OAUTH_PATH=/gcp-oauth.keys.json \
     -e GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json \
     -e MCP_SERVER_MODE=stdio \
     -p 3000:3000 \
     gmail-mcp-server auth
   ```

### Authentication Issues
- Ensure `gcp-oauth.keys.json` is in the project root
- Check that redirect URI `http://localhost:3000/oauth2callback` is configured in Google Cloud Console
- Make sure port 3000 is not in use by another application
- Verify the OAuth keys file format (should contain `web` or `installed` credentials)

### Container Issues
- Check Docker is running: `docker info`
- View container logs: `docker logs gmail-mcp-server`
- Follow logs in real-time: `docker logs -f gmail-mcp-server`
- Verify health: `curl http://localhost:3000/health`
- Check container status: `docker ps -a`

### Permission Issues
- Ensure Docker has permission to bind mount files
- Check that the OAuth keys file is readable: `ls -la gcp-oauth.keys.json`
- Verify Docker volume permissions: `docker volume inspect mcp-gmail`

### Network Issues
- Verify port mapping: `docker port gmail-mcp-server`
- Check if container is accessible: `docker exec -it gmail-mcp-server curl http://localhost:3000/health`
- Test from host: `curl -v http://localhost:3000/health`

## Security Notes

- OAuth credentials are stored in a Docker volume (`mcp-gmail`)
- The `gcp-oauth.keys.json` file is mounted read-only
- Credentials persist between container restarts
- Remove the volume to clear stored credentials: `docker volume rm mcp-gmail`