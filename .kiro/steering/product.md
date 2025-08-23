# Gmail AutoAuth MCP Server

A Model Context Protocol (MCP) server that provides Gmail integration for AI assistants like Claude Desktop. The server enables natural language email management through comprehensive Gmail API integration.

## Core Features

- **Email Operations**: Send, draft, read, search, and delete emails with full attachment support
- **Label Management**: Create, update, delete, and organize Gmail labels
- **Filter Management**: Create and manage Gmail filters with templates for common scenarios
- **Batch Operations**: Efficiently process multiple emails at once
- **Auto Authentication**: Streamlined OAuth2 flow with auto browser launch
- **Multi-Environment**: Supports local development, Docker, and Railway cloud deployment

## Key Capabilities

- Full attachment support (send, receive, download)
- HTML and multipart email handling
- International character support
- Private network CORS handling for secure access
- Dual transport modes (stdio for local, HTTP for cloud)
- Comprehensive error handling and validation

The server acts as a bridge between AI assistants and Gmail, enabling sophisticated email automation and management through natural language interactions.