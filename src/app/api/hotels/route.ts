import { NextRequest, NextResponse } from 'next/server';

// Cache token to avoid re-authenticating every request
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAmadeusToken(): Promise<string> {
    // Check if we have a valid cached token
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
        return cachedToken.token;
    }

    const apiKey = process.env.AMADEUS_API_KEY;
    const apiSecret = process.env.AMADEUS_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new Error('Amadeus API credentials not configured');
    }

    const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: apiKey,
            client_secret: apiSecret,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Amadeus auth error:', error);
        throw new Error('Failed to authenticate with Amadeus');
    }

    const data = await response.json();

    // Cache the token (expires in ~30 minutes, we'll refresh at 25)
    cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 300) * 1000, // Refresh 5 min early
    };

    return data.access_token;
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const checkIn = searchParams.get('checkIn') || getDefaultCheckIn();
    const checkOut = searchParams.get('checkOut') || getDefaultCheckOut();
    const radiusInMeters = parseInt(searchParams.get('radius') || '5000');
    // Force larger radius in test environment to find hotels (min 20km)
    const radius = Math.max(20, Math.ceil(radiusInMeters / 1000));
    const adults = searchParams.get('adults') || '1';

    if (!lat || !lng) {
        return NextResponse.json({ error: 'Missing lat/lng parameters' }, { status: 400 });
    }

    try {
        const token = await getAmadeusToken();

        // First, get hotel list by location
        const hotelsUrl = `https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-geocode?latitude=${lat}&longitude=${lng}&radius=${radius}&radiusUnit=KM&hotelSource=ALL`;

        console.log('Fetching hotels by location...');
        const hotelsResponse = await fetch(hotelsUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!hotelsResponse.ok) {
            const error = await hotelsResponse.text();
            console.error('Hotels list error:', error);
            return NextResponse.json({ error: 'Failed to fetch hotels list' }, { status: 500 });
        }

        const hotelsData = await hotelsResponse.json();
        const hotelIds = hotelsData.data?.slice(0, 10).map((h: any) => h.hotelId) || []; // eslint-disable-line @typescript-eslint/no-explicit-any

        if (hotelIds.length === 0) {
            return NextResponse.json({ hotels: [], message: 'No hotels found in this area' });
        }

        // Get hotel offers (prices) for these hotels
        const offersUrl = `https://test.api.amadeus.com/v3/shopping/hotel-offers?hotelIds=${hotelIds.join(',')}&adults=${adults}&checkInDate=${checkIn}&checkOutDate=${checkOut}&currency=USD`;

        console.log('Fetching hotel offers...');
        const offersResponse = await fetch(offersUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!offersResponse.ok) {
            const error = await offersResponse.text();
            console.error('Hotel offers error:', error);
            // Return hotels without prices if offers fail
            return NextResponse.json({
                hotels: hotelsData.data.slice(0, 10).map((h: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                    id: h.hotelId,
                    name: h.name,
                    address: h.address?.countryCode || '',
                    location: { lat: h.geoCode?.latitude, lng: h.geoCode?.longitude },
                    price: null,
                    priceLabel: 'Price unavailable',
                    rating: null,
                })),
            });
        }

        const offersData = await offersResponse.json();

        console.log('Hotel offers data sample:', JSON.stringify(offersData.data?.[0], null, 2));

        // Transform to our format
        const hotels = (offersData.data || []).map((hotel: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const offer = hotel.offers?.[0];
            const price = offer?.price?.total;
            // Amadeus returns star rating (1-5), not user ratings
            const starRating = hotel.hotel?.rating ? parseInt(hotel.hotel.rating) : null;

            return {
                id: hotel.hotel?.hotelId,
                name: hotel.hotel?.name,
                address: hotel.hotel?.address?.lines?.join(', ') || '',
                city: hotel.hotel?.address?.cityName || '',
                location: {
                    lat: hotel.hotel?.latitude,
                    lng: hotel.hotel?.longitude,
                },
                price: price ? parseFloat(price) : null,
                priceLabel: price ? `$${parseFloat(price).toFixed(0)}/night` : 'Price N/A',
                currency: offer?.price?.currency || 'USD',
                rating: starRating, // This is star rating (1-5), not user review rating
                starRating: starRating,
                amenities: hotel.hotel?.amenities?.slice(0, 5) || [],
                roomType: offer?.room?.description?.text || '',
                checkIn,
                checkOut,
            };
        });

        return NextResponse.json({ hotels });
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error('Error fetching hotels:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}

function getDefaultCheckIn(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7); // 1 week from now
    return date.toISOString().split('T')[0];
}

function getDefaultCheckOut(): string {
    const date = new Date();
    date.setDate(date.getDate() + 8); // 1 week + 1 day
    return date.toISOString().split('T')[0];
}
