// Google Calendar integration service
import { google, calendar_v3 } from 'googleapis';
import { prisma } from './db.js';

// Google OAuth2 Configuration
// Setup: https://console.cloud.google.com/apis/credentials
// Enable: Google Calendar API

// Helper to get OAuth2 client with dynamic credentials
async function getOAuth2Client() {
    // Try to find System/Admin Google config for Client ID/Secret
    // This allows replacing the Env vars with DB config
    const integration = await prisma.integration.findFirst({
        where: {
            provider: 'GOOGLE',
            isEnabled: true,
            OR: [
                { userId: null },
                { user: { role: 'SUPER_ADMIN' } }
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
            // console.log('[Calendar] Using database Client ID/Secret');
        }
    }

    if (!clientId || !clientSecret) {
        throw new Error("Missing Google Client ID/Secret");
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Calendar API instance (initialized after auth)
// Note: Currently simple singleton, which is not ideal for multi-user.
// Ideally should be cached per user.
let calendarApi: calendar_v3.Calendar | null = null;

// Get OAuth URL for user authorization
export async function getGoogleAuthUrl(state?: string): Promise<string> {
    const oauth2Client = await getOAuth2Client();
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state,
        prompt: 'consent',
    });
}

// Exchange auth code for tokens
export async function handleGoogleCallback(code: string, userId: string) {
    try {
        const oauth2Client = await getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Store tokens in Integration table to match our unified "Integrations" logic
        // This makes them visible/editable in the UI if we expose token fields (or just for backend usage)
        if (userId) {
            await prisma.integration.upsert({
                where: {
                    userId_provider: {
                        userId,
                        provider: 'GOOGLE'
                    }
                },
                update: {
                    // Update credentials with new tokens.
                    // IMPORTANT: We need to preserve existing credentials (like clientId if stored per user)
                    // But here we are storing *User* tokens.
                    // The UI for "Google" asks for ClientID/Secret.
                    // If we overwrite that with Tokens, the UI might break if it expects ClientID.
                    // The UI expects: clientId, clientSecret.
                    // Tokens are usually hidden or in a different field.
                    // Let's store tokens in 'metadata' or 'credentials.tokens'.
                    // For now, let's store in metadata to avoid polluting the Config Form which is for App Credentials.
                    metadata: {
                        tokens: tokens as any,
                        updatedAt: new Date()
                    }
                },
                create: {
                    userId,
                    provider: 'GOOGLE',
                    credentials: {}, // User doesn't define ClientID, the Admin does.
                    metadata: {
                        tokens: tokens as any,
                        updatedAt: new Date()
                    }
                }
            });
        }

        // Also keep legacy user update if needed, but 'Integration' is the new standard.
        await prisma.user.update({
            where: { id: userId },
            data: {
                // Legacy support or logging
            },
        });

        // Initialize API for THIS request?
        // Note: Global calendarApi assignment is risky in async multi-user.
        // We really should return the api instance or store it in a request context.
        // For backwards compat with existing code, we update the global, but this is a Known Issue.
        calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });

        return { success: true, tokens };
    } catch (err: any) {
        console.error('[Calendar] OAuth error:', err.message);
        return { success: false, error: err.message };
    }
}

// Initialize calendar with existing tokens
export async function initCalendar(accessToken: string, refreshToken?: string) {
    const oauth2Client = await getOAuth2Client();
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
    });
    calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
}

// Type definitions
interface CalendarEvent {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: string[];
    location?: string;
    reminders?: { method: 'email' | 'popup'; minutes: number }[];
    addMeet?: boolean; // Add Google Meet video conference
}

// Create a calendar event (with optional Google Meet)
export async function createEvent(event: CalendarEvent): Promise<{ success: boolean; eventId?: string; htmlLink?: string; meetLink?: string; error?: string }> {
    if (!calendarApi) {
        return { success: false, error: 'Google Calendar no conectado' };
    }

    try {
        const requestBody: any = {
            summary: event.summary,
            description: event.description,
            location: event.location,
            start: {
                dateTime: event.start.toISOString(),
                timeZone: 'America/Caracas',
            },
            end: {
                dateTime: event.end.toISOString(),
                timeZone: 'America/Caracas',
            },
            attendees: event.attendees?.map(email => ({ email })),
            reminders: {
                useDefault: false,
                overrides: event.reminders || [
                    { method: 'email', minutes: 60 },
                    { method: 'popup', minutes: 15 },
                ],
            },
        };

        // Add Google Meet video conference if requested
        if (event.addMeet) {
            requestBody.conferenceData = {
                createRequest: {
                    requestId: `meet-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            };
        }

        const response = await calendarApi.events.insert({
            calendarId: 'primary',
            requestBody,
            conferenceDataVersion: event.addMeet ? 1 : 0,
        });

        // Extract Google Meet link if created
        const meetLink = response.data.conferenceData?.entryPoints?.find(
            (ep: any) => ep.entryPointType === 'video'
        )?.uri;

        console.log(`[Calendar] Event created: ${response.data.id}${meetLink ? ` (Meet: ${meetLink})` : ''}`);
        return {
            success: true,
            eventId: response.data.id || undefined,
            htmlLink: response.data.htmlLink || undefined,
            meetLink: meetLink || undefined,
        };
    } catch (err: any) {
        console.error('[Calendar] Create event error:', err.message);
        return { success: false, error: err.message };
    }
}

// List upcoming events
export async function listEvents(maxResults = 10): Promise<{ success: boolean; events?: any[]; error?: string }> {
    if (!calendarApi) {
        return { success: false, error: 'Google Calendar no conectado' };
    }

    try {
        const response = await calendarApi.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items?.map(event => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            location: event.location,
            htmlLink: event.htmlLink,
            attendees: event.attendees?.map(a => a.email),
        }));

        return { success: true, events };
    } catch (err: any) {
        console.error('[Calendar] List events error:', err.message);
        return { success: false, error: err.message };
    }
}

// Update an event
export async function updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<{ success: boolean; error?: string }> {
    if (!calendarApi) {
        return { success: false, error: 'Google Calendar no conectado' };
    }

    try {
        const requestBody: any = {};
        if (updates.summary) requestBody.summary = updates.summary;
        if (updates.description) requestBody.description = updates.description;
        if (updates.location) requestBody.location = updates.location;
        if (updates.start) requestBody.start = { dateTime: updates.start.toISOString(), timeZone: 'America/Caracas' };
        if (updates.end) requestBody.end = { dateTime: updates.end.toISOString(), timeZone: 'America/Caracas' };
        if (updates.attendees) requestBody.attendees = updates.attendees.map(email => ({ email }));

        await calendarApi.events.patch({
            calendarId: 'primary',
            eventId,
            requestBody,
        });

        return { success: true };
    } catch (err: any) {
        console.error('[Calendar] Update event error:', err.message);
        return { success: false, error: err.message };
    }
}

// Delete an event
export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    if (!calendarApi) {
        return { success: false, error: 'Google Calendar no conectado' };
    }

    try {
        await calendarApi.events.delete({
            calendarId: 'primary',
            eventId,
        });
        return { success: true };
    } catch (err: any) {
        console.error('[Calendar] Delete event error:', err.message);
        return { success: false, error: err.message };
    }
}

// Quick create: Meeting with client (with Google Meet)
export async function createClientMeeting(
    clientName: string,
    clientEmail: string,
    dateTime: Date,
    durationMinutes = 30,
    notes?: string,
    withMeet = true // Default to including Google Meet
) {
    const endTime = new Date(dateTime.getTime() + durationMinutes * 60000);

    return createEvent({
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
    entityType: 'lead' | 'customer' | 'ticket',
    entityName: string,
    dateTime: Date,
    notes?: string
) {
    const emojis = { lead: '🎯', customer: '👥', ticket: '🎫' };
    const endTime = new Date(dateTime.getTime() + 15 * 60000); // 15 min block

    return createEvent({
        summary: `${emojis[entityType]} Seguimiento: ${entityName}`,
        description: notes || `Recordatorio de seguimiento para ${entityType}: ${entityName}`,
        start: dateTime,
        end: endTime,
        reminders: [
            { method: 'popup', minutes: 5 },
        ],
    });
}

export default {
    getGoogleAuthUrl,
    handleGoogleCallback,
    initCalendar,
    createEvent,
    listEvents,
    updateEvent,
    deleteEvent,
    createClientMeeting,
    createFollowUpReminder,
};
