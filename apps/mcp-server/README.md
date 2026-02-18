# Chronus CRM MCP Server

This is a Model Context Protocol (MCP) server that provides AI agents with context about customers from the Chronus CRM.

## Functionality
It exposes a single tool: `get_customer_context`.
- **Input**: `identifier` (Email or Phone number)
- **Output**: Customer Profile, Open Tickets, Tags, and calculated Stats (LTV, etc.)

## Usage

### Prerequisites
- Node.js v18+
- A running instance of Chronus CRM
- An API Key from Chronus CRM (Generate one in Settings -> API Keys)

### Configuration
Set the following environment variables:
- `CRM_API_URL`: URL of your CRM API (default: `http://localhost:3002`)
- `CRM_API_TOKEN`: Your CRM API Key (starts with `sk_live_`) or a JWT Token.

### Running with Claude Desktop / Cursor
Add this to your MCP settings file:

```json
{
  "mcpServers": {
    "chronus-crm": {
      "command": "node",
      "args": ["/absolute/path/to/chronus/apps/mcp-server/dist/index.js"],
      "env": {
        "CRM_API_URL": "http://localhost:3002",
        "CRM_API_TOKEN": "sk_live_..."
      }
    }
  }
}
```

### Building
```bash
npm install
npm run build
```
