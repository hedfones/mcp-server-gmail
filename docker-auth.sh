#!/bin/bash

# Gmail AutoAuth MCP Server - Authentication Only Script

echo "🔐 Running Gmail OAuth authentication in Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if gcp-oauth.keys.json exists
if [ ! -f "gcp-oauth.keys.json" ]; then
    echo "❌ gcp-oauth.keys.json not found!"
    echo ""
    echo "Please follow these steps to get your OAuth credentials:"
    echo "1. Go to https://console.cloud.google.com/"
    echo "2. Create/select a project and enable Gmail API"
    echo "3. Go to 'APIs & Services' > 'Credentials'"
    echo "4. Create OAuth client ID (Web application)"
    echo "5. Add http://localhost:3000/oauth2callback to redirect URIs"
    echo "6. Download the JSON file and save it as 'gcp-oauth.keys.json' in this directory"
    echo ""
    exit 1
fi

# Check if image exists
if ! docker image inspect gmail-mcp-server > /dev/null 2>&1; then
    echo "📦 Docker image not found. Building..."
    docker build -t gmail-mcp-server .
    if [ $? -ne 0 ]; then
        echo "❌ Docker build failed!"
        exit 1
    fi
fi

# Create Docker volume if it doesn't exist
docker volume create mcp-gmail > /dev/null 2>&1

# Stop any running server container to free up port 3000
docker stop gmail-mcp-server 2>/dev/null || true

echo "🌐 Starting authentication process..."
echo "This will open your browser for Google authentication."
echo "Make sure port 3000 is available."
echo ""

# Run authentication with stdio mode to avoid conflicts
docker run -it --rm \
  --mount type=bind,source="$(pwd)/gcp-oauth.keys.json",target=/gcp-oauth.keys.json \
  -v mcp-gmail:/gmail-server \
  -e GMAIL_OAUTH_PATH=/gcp-oauth.keys.json \
  -e GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json \
  -e MCP_SERVER_MODE=stdio \
  -p 3000:3000 \
  gmail-mcp-server auth

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Authentication completed successfully!"
    echo "📁 Credentials saved to Docker volume 'mcp-gmail'"
    echo ""
    echo "🚀 You can now start the server with:"
    echo "   docker run -d --name gmail-mcp-server -v mcp-gmail:/gmail-server -e GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json -p 3000:3000 gmail-mcp-server"
    echo ""
    echo "Or use the full setup script:"
    echo "   ./docker-setup.sh"
else
    echo ""
    echo "❌ Authentication failed!"
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Make sure port 3000 is not in use: lsof -i :3000"
    echo "2. Check your OAuth redirect URI: http://localhost:3000/oauth2callback"
    echo "3. Verify your gcp-oauth.keys.json file format"
    echo "4. Try running: docker logs <container-id> to see detailed errors"
fi