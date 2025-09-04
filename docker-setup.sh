#!/bin/bash

# Gmail AutoAuth MCP Server - Docker Setup Script

echo "🚀 Setting up Gmail AutoAuth MCP Server with Docker..."

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

echo "✅ Found gcp-oauth.keys.json"

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t gmail-mcp-server .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker image built successfully"

# Create Docker volume for persistent credentials
echo "📁 Creating Docker volume for credentials..."
docker volume create mcp-gmail

# Stop any existing container
echo "🧹 Cleaning up any existing containers..."
docker stop gmail-mcp-server 2>/dev/null || true
docker rm gmail-mcp-server 2>/dev/null || true

# Run authentication
echo "🔐 Running OAuth authentication..."
echo "This will open your browser for Google authentication..."
echo "Make sure port 3000 is available on your host machine."

# Set environment variable to force stdio mode during auth
docker run -it --rm \
  --mount type=bind,source="$(pwd)/gcp-oauth.keys.json",target=/gcp-oauth.keys.json \
  -v mcp-gmail:/gmail-server \
  -e GMAIL_OAUTH_PATH=/gcp-oauth.keys.json \
  -e GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json \
  -e MCP_SERVER_MODE=stdio \
  -p 3000:3000 \
  gmail-mcp-server auth

if [ $? -ne 0 ]; then
    echo "❌ Authentication failed!"
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Make sure port 3000 is not in use by another application"
    echo "2. Check that your OAuth redirect URI is set to: http://localhost:3000/oauth2callback"
    echo "3. Ensure your gcp-oauth.keys.json file is valid"
    echo ""
    exit 1
fi

echo "✅ Authentication completed successfully!"

# Start the server in HTTP mode
echo "🚀 Starting Gmail MCP Server in HTTP mode..."
docker run -d \
  --name gmail-mcp-server \
  -v mcp-gmail:/gmail-server \
  -e GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json \
  -e MCP_SERVER_MODE=http \
  -p 3000:3000 \
  --restart unless-stopped \
  gmail-mcp-server

if [ $? -ne 0 ]; then
    echo "❌ Failed to start server!"
    exit 1
fi

# Wait a moment for the server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Test the server
echo "🧪 Testing server health..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Server is healthy and responding!"
else
    echo "⚠️  Server may still be starting up. Check logs with: docker logs gmail-mcp-server"
fi

echo ""
echo "✅ Gmail MCP Server is now running!"
echo ""
echo "📋 Server Information:"
echo "   Container Name: gmail-mcp-server"
echo "   Port: 3000"
echo "   Mode: HTTP"
echo "   Health Check: http://localhost:3000/health"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs:     docker logs gmail-mcp-server"
echo "   Follow logs:   docker logs -f gmail-mcp-server"
echo "   Stop server:   docker stop gmail-mcp-server"
echo "   Start server:  docker start gmail-mcp-server"
echo "   Remove server: docker rm -f gmail-mcp-server"
echo "   Remove volume: docker volume rm mcp-gmail"
echo ""
echo "🧪 Test the server:"
echo "   curl http://localhost:3000/health"
echo ""
echo "📝 For Claude Desktop, use this MCP configuration:"
echo '   {'
echo '     "mcpServers": {'
echo '       "gmail": {'
echo '         "command": "docker",'
echo '         "args": ['
echo '           "run", "-i", "--rm",'
echo '           "-v", "mcp-gmail:/gmail-server",'
echo '           "-e", "GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json",'
echo '           "gmail-mcp-server"'
echo '         ]'
echo '       }'
echo '     }'
echo '   }'