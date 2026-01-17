import { NextRequest, NextResponse } from 'next/server';

interface DistanceRequest {
    origin: { lat: number; lng: number };
    destinations: Array<{ lat: number; lng: number; id: string }>;
}

export async function POST(req: NextRequest) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    try {
        const body: DistanceRequest = await req.json();
        const { origin, destinations } = body;

        if (!origin || !destinations || destinations.length === 0) {
            return NextResponse.json({ error: 'Missing origin or destinations' }, { status: 400 });
        }

        // Format origins and destinations for the API
        const originStr = `${origin.lat},${origin.lng}`;
        const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destinationsStr}&units=imperial&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK') {
            console.error('Distance Matrix API error:', data);
            return NextResponse.json({ error: `Distance API error: ${data.status}` }, { status: 500 });
        }

        // Transform results
        const distances = data.rows[0].elements.map((element: any, index: number) => ({
            id: destinations[index].id,
            distance: element.distance?.text || 'N/A',
            distanceMeters: element.distance?.value || 0,
            duration: element.duration?.text || 'N/A',
            durationSeconds: element.duration?.value || 0,
            status: element.status,
        }));

        return NextResponse.json({ distances });
    } catch (error) {
        console.error('Error calculating distances:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
