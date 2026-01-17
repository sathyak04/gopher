'use client';

import { useEffect, useRef, useState } from 'react';

interface MapViewProps {
    center?: { lat: number; lng: number };
    zoom?: number;
}

export default function MapView({ center = { lat: 34.0522, lng: -118.2437 }, zoom = 12 }: MapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check if Google Maps is already loaded
        if (window.google?.maps) {
            initMap();
            return;
        }

        // Load Google Maps script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            console.log('Google Maps script loaded');
            initMap();
        };

        script.onerror = () => {
            console.error('Failed to load Google Maps script');
            setError('Failed to load Google Maps. Check your API key.');
        };

        document.head.appendChild(script);

        return () => {
            // Cleanup if needed
        };
    }, []);

    const initMap = () => {
        if (!mapRef.current || !window.google?.maps) return;

        try {
            const map = new window.google.maps.Map(mapRef.current, {
                center,
                zoom,
            });

            // Add a marker
            new window.google.maps.Marker({
                position: center,
                map,
                title: 'Test Location',
            });

            setMapLoaded(true);
            console.log('Map initialized successfully!');
        } catch (err) {
            console.error('Error initializing map:', err);
            setError('Error initializing map');
        }
    };

    return (
        <div className="w-full">
            <h3 className="text-lg font-bold mb-2">🗺️ Google Maps Test</h3>
            {error && (
                <div className="p-4 bg-red-100 text-red-700 rounded mb-2">
                    ❌ {error}
                </div>
            )}
            {!mapLoaded && !error && (
                <div className="p-4 bg-yellow-100 text-yellow-700 rounded mb-2">
                    ⏳ Loading map...
                </div>
            )}
            {mapLoaded && (
                <div className="p-2 bg-green-100 text-green-700 rounded mb-2">
                    ✅ Google Maps API is working!
                </div>
            )}
            <div
                ref={mapRef}
                className="w-full h-64 rounded-lg border border-gray-300"
                style={{ minHeight: '250px' }}
            />
        </div>
    );
}

// Add type declaration for Google Maps
declare global {
    interface Window {
        google: any;
    }
}
