import { google } from 'googleapis';
import { prisma } from '../db.js';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Use API_PUBLIC_URL if available (for production/dynamic envs), otherwise fall back to localhost
const BASE_URL = process.env.API_PUBLIC_URL || process.env.Start_URL || 'http://localhost:3002';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${BASE_URL}/auth/google/callback`;

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

export const getAuthUrl = () => {
    const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Crucial for refresh token
        scope: scopes,
        prompt: 'consent' // Force consent to get refresh token
    });
};

export const handleGoogleCallback = async (code: string, userId: string) => {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info to store email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Store tokens in DB
    await prisma.user.update({
        where: { id: userId },
        data: {
            googleAccessToken: tokens.access_token,
            googleRefreshToken: tokens.refresh_token, // Only returned on first consent or forced prompt
            googleCalendarEmail: userInfo.data.email,
            googleTokenExpiry: tokens.expiry_date ? BigInt(tokens.expiry_date) : null
        }
    });

    return userInfo.data;
};

// Helper to set credentials and return user with org info
const setUserContext = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true } // Need org ID for Activity creation
    });

    if (!user) throw new Error("User not found");

    // Set credentials if available (don't throw if not, for hybrid fallback)
    if (user.googleAccessToken) {
        oauth2Client.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken || undefined,
            expiry_date: user.googleTokenExpiry ? Number(user.googleTokenExpiry) : undefined
        });

        oauth2Client.on('tokens', async (tokens) => {
            if (tokens.refresh_token) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { googleRefreshToken: tokens.refresh_token }
                });
            }
            if (tokens.access_token) {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        googleAccessToken: tokens.access_token,
                        googleTokenExpiry: tokens.expiry_date ? BigInt(tokens.expiry_date) : undefined
                    }
                });
            }
        });
    }

    return user;
};

// HYBRID: Get events from both DB and Google
export const getGoogleCalendarEvents = async (userId: string, startStr?: string, endStr?: string) => {
    const user = await setUserContext(userId);
    const orgId = user.memberships[0]?.organizationId;

    let localEvents: any[] = [];
    if (orgId) {
        // Fetch local MEETINGS from Activity
        // Note: Activity doesn't have start/end columns indexable easily, so we fetch metadata
        // In production, we'd use a raw query or better schema. 
        // For now, fetch recent activities and filter in memory (limited by last 100 or specific type query)
        const activities = await prisma.activity.findMany({
            where: {
                organizationId: orgId,
                type: 'MEETING' // Enum value
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        // Map activities to CalendarEvent format
        localEvents = activities.map(a => {
            const meta = a.metadata as any || {};
            return {
                id: a.id, // Use local ID
                summary: meta.summary || a.description,
                description: a.description,
                start: meta.start ? { dateTime: meta.start } : { dateTime: a.createdAt.toISOString() }, // Fallback
                end: meta.end ? { dateTime: meta.end } : { dateTime: new Date(a.createdAt.getTime() + 3600000).toISOString() },
                htmlLink: meta.htmlLink,
                source: 'crm'
            };
        });
    }

    let googleEvents: any[] = [];
    if (user.googleAccessToken) {
        try {
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: startStr || new Date().toISOString(),
                timeMax: endStr,
                maxResults: 50,
                singleEvents: true,
                orderBy: 'startTime',
            });
            googleEvents = (res.data.items || []).map(e => ({ ...e, source: 'google' }));
        } catch (e) {
            console.error("Google Calendar fetch failed:", e);
            // Don't throw, just return local events with error indicator? 
            // Or just return what we have.
        }
    }

    // Merge: If we have a Google event that matches a local event (by ID stored in metadata), override local?
    // Or just concatenate distinct ones.
    // Simplest: Concatenate. Frontend handles display.
    // Ideally dedupe if we stored googleId in local.

    // For now, just return concatenated list.
    return [...localEvents, ...googleEvents];
};

// HYBRID: Create event in DB first, then Google
export const createEvent = async (userId: string, eventDetails: any) => {
    const user = await setUserContext(userId);
    const orgId = user.memberships[0]?.organizationId;

    if (!orgId) throw new Error("User has no organization");

    let googleEvent: any = null;
    let googleError: string | null = null;
    let googleEventId: string | undefined;

    // 1. Try Google Sync first (or parallel, but we want the ID)
    if (user.googleAccessToken) {
        try {
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            const eventConfig: any = {
                summary: eventDetails.summary,
                description: eventDetails.description,
                start: { dateTime: eventDetails.start.toISOString() },
                end: { dateTime: eventDetails.end.toISOString() },
                attendees: eventDetails.attendees ? eventDetails.attendees.map((email: string) => ({ email })) : [],
            };

            if (eventDetails.addMeet) {
                eventConfig.conferenceData = {
                    createRequest: {
                        requestId: `meet-${Date.now()}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' },
                    },
                };
            }

            const res = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: eventConfig,
                conferenceDataVersion: 1,
            });

            googleEvent = res.data;
            googleEventId = res.data.id!;
        } catch (error: any) {
            console.error("Error creating Google Calendar event:", error);
            googleError = error.message;
            // Proceed to save locally anyway
        }
    }

    // 2. Save to Local DB (Activity)
    const metadata = {
        summary: eventDetails.summary,
        start: eventDetails.start.toISOString(),
        end: eventDetails.end.toISOString(),
        attendees: eventDetails.attendees,
        location: eventDetails.location,
        googleEventId: googleEventId,
        htmlLink: googleEvent?.htmlLink,
        meetLink: googleEvent?.hangoutLink,
        googleError
    };

    const activity = await prisma.activity.create({
        data: {
            organizationId: orgId,
            userId: userId,
            type: 'MEETING', // Ensure this enum exists in Schema
            description: eventDetails.summary || "Evento de Calendario",
            metadata: metadata as any
        }
    });

    return {
        success: true,
        event: googleEvent || { id: activity.id, ...metadata, source: 'crm' },
        localId: activity.id,
        googleSync: !!googleEvent
    };
};

export const createClientMeeting = async (
    userId: string,
    clientName: string,
    clientEmail: string,
    start: Date,
    durationMinutes: number,
    notes: string,
    withMeet: boolean
) => {
    try {
        const end = new Date(start.getTime() + durationMinutes * 60000);

        return await createEvent(userId, {
            summary: `Reunión con ${clientName}`,
            description: notes || `Reunión agendada desde CRM.\nCliente: ${clientName}`,
            start,
            end,
            attendees: [clientEmail],
            addMeet: withMeet
        });
    } catch (error: any) {
        console.error("Error creating meeting:", error);
        return { success: false, error: error.message };
    }
};
