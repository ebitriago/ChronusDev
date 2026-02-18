#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const CRM_API_URL = process.env.CRM_API_URL || "http://localhost:3002";
const CRM_API_TOKEN = process.env.CRM_API_TOKEN;

if (!CRM_API_TOKEN) {
    console.error("Error: CRM_API_TOKEN environment variable is required.");
    process.exit(1);
}

// Tool Definitions
const TOOLS = [
    {
        name: "get_customer_context",
        description: "Retrieve rich context about a customer (profile, history, stats).",
        inputSchema: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Email or Phone" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "search_customers",
        description: "Search for customers by name, email, or company (fuzzy search).",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search term" },
            },
            required: ["query"],
        },
    },
    {
        name: "create_lead",
        description: "Create a new Lead or Customer in the CRM.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                company: { type: "string" },
                status: { type: "string", enum: ["TRIAL", "ACTIVE", "LEAD"], default: "LEAD" },
            },
            required: ["name", "email"],
        },
    },
    {
        name: "create_ticket",
        description: "Create a support ticket for a customer.",
        inputSchema: {
            type: "object",
            properties: {
                customerId: { type: "string", description: "UUID of the customer" },
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
            },
            required: ["customerId", "title", "description", "priority"],
        },
    },
    {
        name: "list_products",
        description: "List available products, prices, and inventory stock.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "create_invoice",
        description: "Create a new Invoice or Quote (Sales).",
        inputSchema: {
            type: "object",
            properties: {
                customerId: { type: "string" },
                leadId: { type: "string" },
                type: { type: "string", enum: ["INVOICE", "QUOTE"], default: "INVOICE" },
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            description: { type: "string" },
                            quantity: { type: "number" },
                            unitPrice: { type: "number" },
                        },
                        required: ["description", "quantity", "unitPrice"]
                    }
                },
                dueDate: { type: "string", description: "ISO Date string" },
                notes: { type: "string" }
            },
            required: ["items"],
        },
    },
    {
        name: "create_order",
        description: "Create a simple Order / Shopping Cart for a customer.",
        inputSchema: {
            type: "object",
            properties: {
                customerId: { type: "string" },
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            productId: { type: "string" },
                            quantity: { type: "number" },
                        },
                        required: ["productId", "quantity"]
                    }
                },
            },
            required: ["customerId", "items"],
        },
    },
];

// Server Implementation
const server = new Server(
    {
        name: "chronus-crm-mcp",
        version: "1.2.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: TOOLS as any[],
    };
});

// Use a shared configured axios instance
const apiClient = axios.create({
    baseURL: CRM_API_URL,
    headers: CRM_API_TOKEN?.startsWith("sk_live_")
        ? { "x-api-key": CRM_API_TOKEN, "Content-Type": "application/json" }
        : { "Authorization": `Bearer ${CRM_API_TOKEN}`, "Content-Type": "application/json" },
});

// Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === "get_customer_context") {
            const { identifier } = args as { identifier: string };
            const response = await apiClient.get("/api/ai/context", { params: { identifier } });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
        }

        if (name === "search_customers") {
            const { query } = args as { query: string };
            const response = await apiClient.get("/customers", { params: { search: query } });
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
        }

        if (name === "create_lead") {
            const response = await apiClient.post("/customers", args);
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
        }

        if (name === "create_ticket") {
            const response = await apiClient.post("/tickets", args);
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
        }

        // New Finance & ERP Tools
        if (name === "list_products") {
            const response = await apiClient.get("/erp/products");
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
        }

        if (name === "create_invoice") {
            const response = await apiClient.post("/invoices", args);
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
        }

        if (name === "create_order") {
            const response = await apiClient.post("/erp/orders", args);
            return { content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }] };
        }

        throw new Error(`Tool ${name} not found`);

    } catch (error: any) {
        const errorMsg = axios.isAxiosError(error)
            ? `API Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
            : error.message;

        return {
            content: [{ type: "text", text: `Error executing ${name}: ${errorMsg}` }],
            isError: true,
        };
    }
});

// Start Server
async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server running on stdio");
}

runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
