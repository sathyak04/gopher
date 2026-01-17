import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const keyword = searchParams.get('keyword');

    if (!keyword) {
        return NextResponse.json({ error: 'Missing keyword parameter' }, { status: 400 });
    }

    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Ticketmaster API key not configured' }, { status: 500 });
    }

    try {
        const url = `https://app.ticketmaster.com/discovery/v2/events.json?keyword=${encodeURIComponent(keyword)}&apikey=${apiKey}&size=10`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.error('Ticketmaster API error:', data);
            return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
        }

        // Extract relevant event information
        const events = data._embedded?.events?.map((event: any) => {
            const venue = event._embedded?.venues?.[0];
            return {
                id: event.id,
                name: event.name,
                date: event.dates?.start?.localDate || 'TBD',
                time: event.dates?.start?.localTime || '',
                venue: venue?.name || 'Venue TBD',
                city: venue?.city?.name || '',
                state: venue?.state?.stateCode || '',
                // Add venue coordinates for Google Places search
                location: venue?.location ? {
                    lat: parseFloat(venue.location.latitude),
                    lng: parseFloat(venue.location.longitude),
                } : null,
                image: event.images?.find((img: any) => img.ratio === '16_9' && img.width > 500)?.url
                    || event.images?.[0]?.url
                    || '',
                url: event.url,
                priceRange: event.priceRanges?.[0]
                    ? `$${event.priceRanges[0].min} - $${event.priceRanges[0].max}`
                    : 'Price TBD',
            };
        }) || [];

        return NextResponse.json({ events });
    } catch (error) {
        console.error('Error fetching events:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
