# AI Integration Guide for Chronus CRM

This guide explains how to connect Artificial Intelligence (AI) agents to your Chronus CRM. This allows AI assistants (like Claude, Cursor, or custom bots) to **read** customer data and **act** on your behalf (create leads, tickets, etc.).

## 1. Architecture

We use the **Model Context Protocol (MCP)** to expose CRM capabilities to AI agents.

- **MCP Server**: Located in `apps/mcp-server`. It wraps the CRM API.
- **CRM API**: The core backend that the MCP server communicates with.
- **Authentication**: AI agents authenticate using a **dedicated AI User** with an API Key.

## 2. Setup

### Step 1: Create an AI Service Account
Run the following script to generate a dedicated user for your AI. This ensures audit logs show "Chronus AI Agent" instead of a generic user.

```bash
# In your terminal
cd apps/crm
npx tsx scripts/create-ai-user.ts
```

**Output:**
```
User: ai-agent@chronus.com
Org:  [Your Organization]
🔑 API KEY: sk_live_ai_...  <-- SAVE THIS KEY!
```

### Step 2: Configure MCP Server
You can run the MCP server locally or deploying it.

**Requirements:**
- `CRM_API_URL`: Your CRM URL (e.g., `http://localhost:3002` or `https://api.crm.chronus.dev`)
- `CRM_API_TOKEN`: The API Key from Step 1.

## 3. Connecting to AI Tools

### Option A: Claude Desktop (macOS)
1. Open config: `code ~/Library/Application\ Support/Claude/claude_desktop_config.json`
2. Add:
```json
{
  "mcpServers": {
    "chronus-crm": {
      "command": "node",
      "args": ["/absolute/path/to/chronus/apps/mcp-server/dist/index.js"],
      "env": {
        "CRM_API_URL": "http://localhost:3002",
        "CRM_API_TOKEN": "sk_live_ai_..."
      }
    }
  }
}
```

### Option B: Cursor (IDE)
1. Go to **Settings** > **Features** > **MCP Servers**.
2. Add Server:
    - **Name**: `chronus-crm`
    - **Type**: `command`
    - **Command**: `node /absolute/path/to/chronus/apps/mcp-server/dist/index.js`
    - **Env**: Set `CRM_API_URL` and `CRM_API_TOKEN`.

## 4. Available Tools

The AI can now perform the following actions:

| Tool | Description | Example Prompt |
| :--- | :--- | :--- |
| `get_customer_context` | Get rich profile, LTV, tickets, tags | "Who is user@email.com?" |
| `search_customers` | Fuzzy search by name/company | "Find clients named 'Tech'" |
| `create_lead` | Create a new lead/customer | "Create a lead for John Doe at john@doe.com" |
| `create_ticket` | Open a support ticket | "Open a high priority ticket for customer X" |
| `list_products` | Check price and inventory | "Do we have any MacBook Pro in stock?" |
| `create_invoice` | Create an invoice/quote | "Create an invoice for user@email.com for 2 Consultations at $50" |
| `create_order` | Create a simple order | "Add one iPhone to John's cart" |

## 5. Security Note
- The API Key (`sk_live_...`) gives **Admin-level access**. Keep it secure.
- The `Chronus AI Agent` user acts as a full administrator within the assigned organization.
