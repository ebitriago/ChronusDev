// Google Calendar integration service
import { google, calendar_v3 } from 'googleapis';
import { prisma } from './db.js';

// Google OAuth2 Configuration
// Setup: https://console.cloud.google.com/apis/credentials
// Enable: Google Calendar API

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3002/auth/google/callback'
);

// Calendar API instance (initialized after auth)
let calendarApi: calendar_v3.Calendar | null = null;

// Get OAuth URL for user authorization
export function getGoogleAuthUrl(state?: string): string {
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
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Store tokens in user record (for persistence)
        await prisma.user.update({
            where: { id: userId },
            data: {
                // Store tokens in a JSON field or separate table
                // For now, we'll log success
            },
        });

        calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
        return { success: true, tokens };
    } catch (err: any) {
        console.error('[Calendar] OAuth error:', err.message);
        return { success: false, error: err.message };
    }
}

// Initialize calendar with existing tokens
export function initCalendar(accessToken: string, refreshToken?: string) {
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
