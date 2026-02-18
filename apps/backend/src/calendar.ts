// Google Calendar integration service
import { google, calendar_v3 } from 'googleapis';
import { prisma } from './db.js';

async function getOAuth2Config() {
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
    let redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback';

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

export async function getOAuth2Client(tokens?: any) {
    const { clientId, clientSecret, redirectUri } = await getOAuth2Config();
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    
    if (tokens) {
        oauth2Client.setCredentials(tokens);
    }

    return oauth2Client;
}

async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
    const integration = await prisma.integration.findUnique({
        where: {
            userId_provider: {
                userId,
                provider: 'GOOGLE'
            }
        }
    });

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

export async function getGoogleAuthUrl(userId?: string): Promise<string> {
    const oauth2Client = await getOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar'],
        prompt: 'consent',
        state: userId || ''
    });
}

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

export interface CalendarEvent {
    summary: string;
    description?: string;
    location?: string;
    start: Date;
    end: Date;
    attendees?: string[];
    reminders?: { method: string; minutes: number }[];
    addMeet?: boolean;
}

export async function createEvent(userId: string, event: CalendarEvent, organizationId?: string): Promise<{ success: boolean; eventId?: string; htmlLink?: string; meetLink?: string; error?: string }> {
    let googleEvent: any = null;
    let googleError: string | null = null;
    let googleEventId: string | undefined;

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

    try {
        const dbEvent = await prisma.calendarEvent.create({
            data: {
                userId,
                summary: event.summary,
                description: event.description,
                location: event.location,
                start: event.start,
                end: event.end,
                googleEventId: googleEventId || undefined
            }
        });

        return {
            success: true,
            eventId: dbEvent.id,
            htmlLink: googleEvent?.htmlLink,
            meetLink: googleEvent?.hangoutLink,
            error: googleError || undefined
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function listEvents(userId: string, startDate?: Date, endDate?: Date) {
    try {
        const calendar = await getCalendarClient(userId);
        const timeMin = startDate?.toISOString() || new Date().toISOString();
        const timeMax = endDate?.toISOString();

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin,
            timeMax,
            maxResults: 50,
            singleEvents: true,
            orderBy: 'startTime',
        });

        return response.data.items || [];
    } catch (err: any) {
        console.error('[Calendar] List events error:', err);
        return [];
    }
}
