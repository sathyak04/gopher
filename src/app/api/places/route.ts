import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const type = searchParams.get('type') || 'restaurant'; // restaurant, lodging
    const radius = searchParams.get('radius') || '1500'; // meters
    const minRating = parseFloat(searchParams.get('minRating') || '0');
    const maxPrice = parseInt(searchParams.get('maxPrice') || '4'); // 1-4 scale

    if (!lat || !lng) {
        return NextResponse.json({ error: 'Missing lat/lng parameters' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
    }

    try {
        // Use Google Places Nearby Search
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            console.error('Google Places API error:', data);
            return NextResponse.json({ error: `Places API error: ${data.status}` }, { status: 500 });
        }

        // Filter and transform results
        const places = (data.results || [])
            .filter((place: any) => {
                // Filter by rating
                if (minRating > 0 && (!place.rating || place.rating < minRating)) {
                    return false;
                }
                // Filter by price level
                if (place.price_level !== undefined && place.price_level > maxPrice) {
                    return false;
                }
                return true;
            })
            .slice(0, 10) // Limit to 10 results
            .map((place: any) => ({
                id: place.place_id,
                name: place.name,
                address: place.vicinity,
                rating: place.rating || 0,
                userRatingsTotal: place.user_ratings_total || 0,
                priceLevel: place.price_level, // 0-4
                priceLabel: getPriceLabel(place.price_level),
                types: place.types,
                location: {
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng,
                },
                photo: place.photos?.[0]?.photo_reference
                    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`
                    : null,
                openNow: place.opening_hours?.open_now,
            }));

        return NextResponse.json({ places });
    } catch (error) {
        console.error('Error fetching places:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

function getPriceLabel(priceLevel: number | undefined): string {
    switch (priceLevel) {
        case 0: return 'Free';
        case 1: return '$';
        case 2: return '$$';
        case 3: return '$$$';
        case 4: return '$$$$';
        default: return 'Price N/A';
    }
}
