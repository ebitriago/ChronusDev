# AssistAI Integration Guide

## Overview

ChronusCRM integrates with AssistAI to provide:
1.  **AI Agents**: Intelligent bots that handle customer queries.
2.  **Omnichannel Support**: Unified inbox for WhatsApp and Instagram.
3.  **Hybrid Control**: Seamless handover between AI and human agents.

## Architecture

The integration is built on a Service-Router pattern:
- **Service (`src/services/assistai.ts`)**: Handles all external API communication with AssistAI. It manages authentication, rate limiting, and caching.
- **Router (`src/routes/assistai.ts`)**: Exposes REST endpoints to the frontend, acting as a secure proxy.
- **Frontend (`components/AssistAI.tsx`)**: Consumes these endpoints to display agent status and conversations.

## API Endpoints

All endpoints are prefixed with `/api/assistai`.

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/agents` | List all available agents |
| `GET` | `/agents/:code` | Get detailed agent info + remote config |
| `PUT` | `/agents/:code/config` | Update local notes/name for an agent |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/conversations` | List active conversations |
| `GET` | `/conversations/:uuid/messages` | Get message history |
| `POST` | `/conversations/:uuid/messages` | Send a message (as agent) |
| `POST` | `/sync-all` | Force synchronization with AssistAI |

## Configuration

Configuration is now managed at the Organization level via the CRM UI, supporting multi-tenancy.

**Steps to Configure:**
1.  Navigate to **Settings > Integrations**.
2.  Locate the **AssistAI** card.
3.  Click **Configurar**.
4.  Enter your credentials:
    *   **API Token**: Your AssistAI JWT Token.
    *   **Tenant Domain**: Your assigned tenant ID (e.g., `ce2307...`).
    *   **Organization Code**: Your organization ID (e.g., `d59b32...`).
5.  Save changes. The system will verify the connection and show a "Conectado" badge.

> **Note**: Environment variables (`ASSISTAI_API_TOKEN`, etc.) are supported as fallbacks but UI configuration takes precedence.

## Advanced Features

### Hybrid Takeover
When a human agent sends a message from the Inbox, the system can optionally pause the AI agent for a specific duration (e.g., 30 mins) to prevent interference.

### Dual Channel
The system supports both WhatsApp (via Meta API or WhatsMeow) and Instagram. The `source` field in conversations indicates the origin.
