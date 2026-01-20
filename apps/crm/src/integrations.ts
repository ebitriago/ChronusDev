// Integrations Management Service
import { prisma } from './db.js';

type IntegrationProvider = 'GOOGLE' | 'GMAIL' | 'ASSISTAI';

interface IntegrationConfig {
    provider: IntegrationProvider;
    credentials: Record<string, any>;
    isEnabled: boolean;
    metadata?: Record<string, any>;
}

// Get user integrations
export async function getUserIntegrations(userId: string) {
    const integrations = await prisma.integration.findMany({
        where: { userId },
    });

    // Return simplified objects safely (should mask secrets in full prod, but returning for edit for now)
    return integrations.map(i => ({
        provider: i.provider,
        isEnabled: i.isEnabled,
        credentials: i.credentials, // Be specific about what to return in production!
        metadata: i.metadata,
    }));
}

// Save user integration
export async function saveUserIntegration(userId: string, config: IntegrationConfig) {
    // Upsert integration
    const integration = await prisma.integration.upsert({
        where: {
            userId_provider: {
                userId,
                provider: config.provider,
            },
        },
        update: {
            credentials: config.credentials, // Encrypt this in production!
            isEnabled: config.isEnabled,
            metadata: config.metadata,
        },
        create: {
            userId,
            provider: config.provider,
            credentials: config.credentials,
            isEnabled: config.isEnabled,
            metadata: config.metadata,
        },
    });

    return integration;
}

// Get system-wide integration (userId = null)
// Helpful for admin settings or defaults
export async function getSystemIntegration(provider: string) {
    return prisma.integration.findFirst({
        where: {
            provider,
            userId: null
        }
    });
}
