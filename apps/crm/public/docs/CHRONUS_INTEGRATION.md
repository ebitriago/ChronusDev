# ChronusDev Integration & API Documentation

## Overview
ChronusDev CRM integrates directly with the ChronusDev Project Management System. This integration ensures that Clients and Support Tickets in the CRM are automatically synchronized with Projects and Tasks in the Development backend.

## Integration Logic

### Client Loop
1. **Create Customer** (CRM) -> **Create Client** (ChronusDev)
2. **Create Client** (ChronusDev) -> **Create Support Project** (ChronusDev)
3. **Link**: The CRM stores `chronusDevClientId` and `chronusDevDefaultProjectId` on the Customer record.

### Ticket Loop
1. **Create Ticket** (CRM) -> **Create Task** (ChronusDev)
   - The task is created in the customer's "Support Project".
   - Task Title: `[CRM] {Ticket Title}`
   - Task Description: Contains Ticket ID and original description.
2. **Link**: The Ticket stores `chronusDevTaskId`.

## API Endpoints for AI Agents

To facilitate AI integration (e.g., from AssistAI or external agents), we provide simplified endpoints.

### Authentication
Include `x-api-key: chronus-ai-key` in headers.

### Create Ticket (AI Webhook)
**POST** `/api/ai/tickets`

Simplified endpoint that handles Customer lookup/creation and auto-syncs to ChronusDev.

**Body:**
```json
{
  "customerEmail": "client@example.com",
  "title": "Issue with login",
  "description": "User cannot reset password...",
  "priority": "HIGH"  // Optional: LOW, MEDIUM, HIGH, URGENT
}
```

**Response:**
```json
{
  "success": true,
  "ticket": {
    "id": "tkt-176...",
    "title": "[AI] Issue with login",
    "status": "IN_PROGRESS", // Automatically set to IN_PROGRESS if synced
    "chronusDevTaskId": "t-..."
  }
}
```

## Standard API

### Create Ticket (Standard)
**POST** `/tickets`

**Body:**
```json
{
  "customerId": "cust-123",
  "title": "Manual Ticket",
  "description": "...",
  "priority": "MEDIUM"
}
```

### Create Customer
**POST** `/customers`

**Body:**
```json
{
  "name": "New Corp",
  "email": "contact@newcorp.com",
  "phone": "123-456-7890"
}
```
