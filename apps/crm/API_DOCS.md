# ChronusCRM API Documentation

Welcome to the **ChronusCRM Open API**. This API allows external applications (landing pages, chatbots, custom forms) to interact with the CRM.

## Base URL
All internal API requests usually go to:
`http://localhost:3002` (Local Development)

## Authentication
*Currently open for internal development. Future versions will require an API Key.*

---

## 🚀 Leads API
Integrate your landing pages or lead magnet forms.

### Create a Lead
**POST** `/leads`

Use this for server-side integrations or manual API calls.

**Payload:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "company": "Tech Inc",
  "value": 1500,
  "notes": "Interested in Premium Plan",
  "source": "API"
}
```

---

## 🪝 Webhooks
Real-time ingestion endpoints for external events.

### 1. Incoming Lead (Landing Page Form)
**POST** `/webhooks/leads/incoming`

Perfect for Webflow, WordPress, or simple HTML forms.

**Payload:**
```json
{
  "name": "John Smith",
  "email": "john@test.com",
  "company": "Web Design Co",
  "notes": "Submitted from Contact Form"
}
```

### 2. Incoming Message (Unified Inbox)
**POST** `/webhooks/messages/incoming`   *(Coming Soon)*

Push messages from WhatsApp, Instagram, or custom chat widgets into the CRM Inbox.

**Payload:**
```json
{
  "from": "+15550123456",
  "content": "Hello, I need support with my invoice.",
  "platform": "whatsapp" // or 'instagram', 'sms'
}
```

---

## 👥 Customers API
Read-only access to customer data for external dashboards.

### List Customers
**GET** `/customers`

**Response:**
```json
[
    {
    "id": "cust-123",
    "name": "Acme Corp",
    "email": "contact@acme.com",
    "status": "ACTIVE"
    }
]
```

---

## 🤖 AssistAI Integration

The CRM includes a robust integration with **AssistAI** for AI-driven customer support.

### Features
- **Agent Management**: View and configure AI agents.
- **Unified Inbox**: Chat with customers across WhatsApp and Instagram.
- **Smart Sync**: Automatic synchronization of conversations and messages.

### Full API Reference
For a complete list of endpoints, schemas, and interactive testing, please visit our **Scalar API Documentation** (hosted at `/api/docs` in your local environment).

[👉 Read the Full Integration Guide](docs/ASSISTAI_INTEGRATION.md)

---

## 👑 Super Admin & SaaS Management
APIs for managing the platform, organizations, and global users. **Requires SUPER_ADMIN role.**

### Organization Management

#### List Organizations
**GET** `/organizations`
Returns a list of all organizations with their subscription status and service flags.

#### Create Organization
**POST** `/organizations`
Creates a brand new "clean" organization with optional admin user.
```json
{
  "name": "New Client Corp",
  "adminEmail": "admin@newclient.com", // Optional, will create user/invite
  "enabledServices": "CRM,CHRONUSDEV"   // Services to enable
}
```

#### Update Organization
**PUT** `/organizations/:id`
Updates services or details.

### User Management (Global)

#### Find Users
**GET** `/admin/users?search=query`
Global search for users by name or email across all organizations.

#### Impersonate User ("Login As")
**POST** `/admin/impersonate`
Generate a login token for any user (Critical Spec).
```json
{ "userId": "user-uuid" }
```

#### Suspend User
**POST** `/admin/users/:id/suspend`
Block access for a user.

