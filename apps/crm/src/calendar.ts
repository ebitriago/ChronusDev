// Google Calendar integration service
import { google, calendar_v3 } from 'googleapis';
import { prisma } from './db.js';

// Google OAuth2 Configuration
// Setup: https://console.cloud.google.com/apis/credentials
// Enable: Google Calendar API

// Helper to get OAuth2 client configuration (Client ID & Secret)
// This usually comes from the Environment or a System-level Integration
async function getOAuth2Config() {
    // Try to find System/Admin Google config for Client ID/Secret
    const integration = await prisma.integration.findFirst({
        where: {
            provider: 'GOOGLE',
            isEnabled: true,
            OR: [
                { userId: null },
                { user: { role: 'SUPER_ADMIN' } } // Assuming Admin handles the OAuth App credentials
            ]
        }
    });

    let clientId = process.env.GOOGLE_CLIENT_ID;
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    let redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3002/auth/google/callback';

    if (integration && integration.credentials && typeof integration.credentials === 'object') {
        const creds = integration.credentials as any;
        if (creds.clientId && creds.clientSecret) {
            clientId = creds.clientId;
            clientSecret = creds.clientSecret;
        }
    }

    if (integration && integration.metadata && typeof integration.metadata === 'object') {
        const meta = integration.metadata as any;
        if (meta.redirectUri) redirectUri = meta.redirectUri;
    }

    if (!clientId || !clientSecret) {
        throw new Error("Missing Google Client ID/Secret configuration");
    }

    return { clientId, clientSecret, redirectUri };
}

// Get the OAuth2 Client instance
// If tokens are provided, they are set.
export async function getOAuth2Client(tokens?: any) {
    const { clientId, clientSecret, redirectUri } = await getOAuth2Config();
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    if (tokens) {
        oauth2Client.setCredentials(tokens);
    }

    return oauth2Client;
}

// Get an authenticated Calendar API client for a specific user
async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
    let integration;
    try {
        integration = await prisma.integration.findUnique({
            where: {
                userId_provider: {
                    userId,
                    provider: 'GOOGLE'
                }
            }
        });
    } catch (e) {
        // Validation error often means userId is missing or schema mismatch.
        // Treat as not connected.
        // console.warn("Prisma findUnique failed in getCalendarClient:", e);
        integration = null;
    }

    if (!integration || !integration.metadata) {
        throw new Error("Google Calendar no conectado");
    }

    const metadata = integration.metadata as any;
    if (!metadata.tokens) {
        throw new Error("Token de Google no encontrado. Por favor reconecte.");
    }

    const oauth2Client = await getOAuth2Client(metadata.tokens);

    oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
            console.log('[Calendar] Refreshing tokens for user', userId);
        }
        await prisma.integration.update({
            where: { id: integration.id },
            data: {
                metadata: {
                    ...metadata,
                    tokens: {
                        ...metadata.tokens,
                        ...tokens
                    },
                    updatedAt: new Date()
                }
            }
        });
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Get OAuth URL for user authorization
export async function getGoogleAuthUrl(userId?: string): Promise<string> {
    const oauth2Client = await getOAuth2Client();
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Critical for receiving refresh_token
        scope: scopes,
        state: userId, // Pass userId as state to identify who is connecting
        prompt: 'consent', // Force consent to ensure we get refresh_token
    });
}

// Exchange auth code for tokens
export async function handleGoogleCallback(code: string, userId: string) {
    try {
        const oauth2Client = await getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);

        if (userId) {
            await prisma.integration.upsert({
                where: {
                    userId_provider: {
                        userId,
                        provider: 'GOOGLE'
                    }
                },
                update: {
                    metadata: {
                        tokens: tokens as any,
                        updatedAt: new Date(),
                        connected: true
                    }
                },
                create: {
                    userId,
                    provider: 'GOOGLE',
                    credentials: {},
                    metadata: {
                        tokens: tokens as any,
                        updatedAt: new Date(),
                        connected: true
                    }
                }
            });
        }

        return { success: true, tokens };
    } catch (err: any) {
        console.error('[Calendar] OAuth error:', err.message);
        return { success: false, error: err.message };
    }
}

// Type definitions
export interface CalendarEvent {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: string[];
    location?: string;
    reminders?: { method: 'email' | 'popup'; minutes: number }[];
    addMeet?: boolean;
}

// Create a calendar event
// HYBRID: Create event in Google (if connected) and always in DB (Activity)
export async function createEvent(userId: string, event: CalendarEvent, organizationId?: string): Promise<{ success: boolean; eventId?: string; htmlLink?: string; meetLink?: string; error?: string }> {
    let googleEvent: any = null;
    let googleError: string | null = null;
    let googleEventId: string | undefined;

    // 1. Try Google Sync
    try {
        const calendar = await getCalendarClient(userId);

        const requestBody: any = {
            summary: event.summary,
            description: event.description,
            location: event.location,
            start: { dateTime: event.start.toISOString() },
            end: { dateTime: event.end.toISOString() },
            attendees: event.attendees?.map(email => ({ email })),
            reminders: {
                useDefault: false,
                overrides: event.reminders || [
                    { method: 'email', minutes: 60 },
                    { method: 'popup', minutes: 15 },
                ],
            },
        };

        if (event.addMeet) {
            requestBody.conferenceData = {
                createRequest: {
                    requestId: `meet-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            };
        }

        const response = await calendar.events.insert({
            calendarId: 'primary',
            requestBody,
            conferenceDataVersion: event.addMeet ? 1 : 0,
        });

        googleEvent = response.data;
        googleEventId = response.data.id!;
    } catch (err: any) {
        console.warn(`[Calendar] Google Sync skipped/failed for user ${userId}:`, err.message);
        googleError = err.message;
    }

    // 2. Save to Local DB (Activity)
    try {
        let orgId = organizationId;
        if (!orgId) {
            const member = await prisma.organizationMember.findFirst({
                where: { userId }
            });
            orgId = member?.organizationId;
        }

        if (orgId) {
            const metadata = {
                summary: event.summary,
                start: event.start.toISOString(),
                end: event.end.toISOString(),
                attendees: event.attendees,
                location: event.location,
                googleEventId: googleEventId,
                htmlLink: googleEvent?.htmlLink,
                meetLink: googleEvent?.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri,
                googleError
            };

            const activity = await prisma.activity.create({
                data: {
                    organizationId: orgId,
                    userId: userId,
                    type: 'MEETING',
                    description: event.summary || "Evento de Calendario",
                    metadata: metadata as any
                }
            });

            return {
                success: true,
                eventId: googleEventId || activity.id,
                htmlLink: googleEvent?.htmlLink,
                meetLink: metadata.meetLink,
            };
        }
    } catch (dbErr: any) {
        console.error("Local DB Save failed:", dbErr);
        // If both failed, return error
        if (!googleEvent) {
            const finalError = (googleError && !googleError.includes('Invalid')) ? googleError : dbErr.message;
            return { success: false, error: finalError };
        }
    }

    // Default return if google worked but DB failed (unlikely but safe)
    return {
        success: true,
        eventId: googleEventId,
        htmlLink: googleEvent?.htmlLink,
        meetLink: googleEvent?.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri,
    };
}

// List upcoming events with support for Range and MaxResults
// HYBRID: List events from DB + Google
export async function listEvents(
    userId: string,
    options: { maxResults?: number; timeMin?: Date; timeMax?: Date } = {}
): Promise<{ success: boolean; events?: any[]; error?: string }> {
    let localEvents: any[] = [];
    let googleEvents: any[] = [];
    let googleError: string | null = null;

    // 1. Fetch from Google
    try {
        const calendar = await getCalendarClient(userId);

        const requestParams: any = {
            calendarId: 'primary',
            singleEvents: true,
            orderBy: 'startTime',
        };

        if (options.maxResults) requestParams.maxResults = options.maxResults;
        if (options.timeMin) requestParams.timeMin = options.timeMin.toISOString();
        if (options.timeMax) requestParams.timeMax = options.timeMax.toISOString();

        if (!options.timeMin && !options.timeMax && !options.maxResults) {
            requestParams.timeMin = new Date().toISOString();
            requestParams.maxResults = 10;
        }

        const response = await calendar.events.list(requestParams);
        googleEvents = response.data.items?.map(event => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            location: event.location,
            htmlLink: event.htmlLink,
            meetLink: event.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri,
            attendees: event.attendees?.map(a => a.email),
            source: 'google'
        })) || [];

    } catch (err: any) {
        // Just log, don't break
        googleError = err.message;
    }

    // 2. Fetch from Local DB
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { memberships: true }
        });
        const orgId = user?.memberships[0]?.organizationId;

        if (orgId) {
            const activities = await prisma.activity.findMany({
                where: {
                    organizationId: orgId,
                    type: 'MEETING',
                },
                orderBy: { createdAt: 'desc' },
                take: 100 // Limit for now
            });

            localEvents = activities.map(a => {
                const meta = a.metadata as any || {};
                // Filter by date if options provided (manual filtering since handled in memory/metadata)
                const start = meta.start ? new Date(meta.start) : a.createdAt;

                // Simple date filter
                if (options.timeMin && start < options.timeMin) return null;
                if (options.timeMax && start > options.timeMax) return null;

                return {
                    id: a.id,
                    summary: meta.summary || a.description,
                    description: a.description,
                    start: meta.start || a.createdAt.toISOString(),
                    end: meta.end || new Date(a.createdAt.getTime() + 3600000).toISOString(),
                    location: meta.location,
                    htmlLink: meta.htmlLink,
                    meetLink: meta.meetLink,
                    attendees: meta.attendees, // string or array
                    source: 'crm'
                };
            }).filter(e => e !== null);
        }
    } catch (e) {
        console.error("Local fetch failed:", e);
    }

    // Return merged list
    return { success: true, events: [...localEvents, ...googleEvents] };
}

// Update an event
export async function updateEvent(userId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<{ success: boolean; error?: string }> {
    try {
        const calendar = await getCalendarClient(userId);

        const requestBody: any = {};
        if (updates.summary) requestBody.summary = updates.summary;
        if (updates.description) requestBody.description = updates.description;
        if (updates.location) requestBody.location = updates.location;
        if (updates.start) requestBody.start = { dateTime: updates.start.toISOString() };
        if (updates.end) requestBody.end = { dateTime: updates.end.toISOString() };
        if (updates.attendees) requestBody.attendees = updates.attendees.map(email => ({ email }));

        await calendar.events.patch({
            calendarId: 'primary',
            eventId,
            requestBody,
        });

        return { success: true };
    } catch (err: any) {
        console.error(`[Calendar] Update event error for user ${userId}:`, err.message);
        return { success: false, error: err.message };
    }
}

// Delete an event
export async function deleteEvent(userId: string, eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const calendar = await getCalendarClient(userId);
        await calendar.events.delete({
            calendarId: 'primary',
            eventId,
        });
        return { success: true };
    } catch (err: any) {
        console.error(`[Calendar] Delete event error for user ${userId}:`, err.message);
        return { success: false, error: err.message };
    }
}

// Quick create: Meeting with client
export async function createClientMeeting(
    userId: string,
    clientName: string,
    clientEmail: string,
    dateTime: Date,
    durationMinutes = 30,
    notes?: string,
    withMeet = true
) {
    const endTime = new Date(dateTime.getTime() + durationMinutes * 60000);

    return createEvent(userId, {
        summary: `Reunión con ${clientName}`,
        description: notes || `Reunión agendada desde ChronusCRM con ${clientName}`,
        start: dateTime,
        end: endTime,
        attendees: [clientEmail],
        addMeet: withMeet,
        reminders: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 },
        ],
    });
}

// Quick create: Follow-up reminder
export async function createFollowUpReminder(
    userId: string,
    entityType: 'lead' | 'customer' | 'ticket',
    entityName: string,
    dateTime: Date,
    notes?: string
) {
    const emojis = { lead: '🎯', customer: '👥', ticket: '🎫' };
    const endTime = new Date(dateTime.getTime() + 15 * 60000);

    return createEvent(userId, {
        summary: `${emojis[entityType]} Seguimiento: ${entityName}`,
        description: notes || `Recordatorio de seguimiento para ${entityType}: ${entityName}`,
        start: dateTime,
        end: endTime,
        reminders: [
            { method: 'popup', minutes: 5 },
        ],
    });
}

// IMPORTANT: Do not export 'initCalendar' anymore as we do per-request init
export default {
    getGoogleAuthUrl,
    handleGoogleCallback,
    createEvent,
    listEvents,
    updateEvent,
    deleteEvent,
    createClientMeeting,
    createFollowUpReminder,
    getOAuth2Client // verification export
};
