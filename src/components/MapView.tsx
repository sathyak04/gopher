'use client';

import { useEffect, useRef, useState } from 'react';

interface MapViewProps {
    center?: { lat: number; lng: number };
    zoom?: number;
    events?: any[];
    places?: any[];
    selectedEvent?: any | null;
    selectedPlace?: any | null;
    itinerary?: any[];

    onSelectPlace?: (place: any) => void;
    isDarkMode?: boolean;
}

const darkMapStyles = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
    },
    {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
    },
    {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
    },
    {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
    },
    {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
    },
    {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
    },
];

export default function MapView({
    center = { lat: 34.0522, lng: -118.2437 },
    zoom = 12,
    events = [],
    places = [],
    selectedEvent = null,
    selectedPlace = null,
    itinerary = [],
    onSelectPlace,
    isDarkMode = false
}: MapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);

    useEffect(() => {
        const initMap = async () => {
            try {
                // Use dynamic import for the loader functions
                const { setOptions, importLibrary } = await import('@googlemaps/js-api-loader');

                // Configure the loader options
                setOptions({
                    apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY as string,
                    version: 'weekly',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);

                // Import the Maps library
                const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;
                // Also import places library for future use
                await importLibrary('places');

                // Use selected event location if available, otherwise default center
                const initialCenter = selectedEvent?.location || center;

                const newMap = new Map(mapRef.current as HTMLElement, {
                    center: initialCenter,
                    zoom: zoom,
                    disableDefaultUI: false,
                    zoomControl: true,
                    streetViewControl: false,
                });

                setMap(newMap);
            } catch (error) {
                console.error('Error loading Google Maps:', error);
            }
        };

        if (!map) {
            initMap();
        } else {
            map.setOptions({ styles: isDarkMode ? darkMapStyles : null });
        }
    }, [map, center, zoom, selectedEvent, isDarkMode]);

    // Update markers when data changes
    useEffect(() => {
        if (!map) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        const bounds = new google.maps.LatLngBounds();
        let hasPoints = false;

        const addMarker = (item: any, title: string, type: 'event' | 'place' | 'itinerary' | 'selected', isSelected: boolean = false) => {
            const position = item.location;
            if (!position || !position.lat || !position.lng) return;

            // COLOR LOGIC (Tailwind-ish Hex Colors):
            // Event = Red-500 (#EF4444)
            // Selected Place = Green-500 (#22C55E)
            // Place = Blue-500 (#3B82F6)
            // Itinerary = Purple-900 (#581c87) - DARKER PURPLE

            let color = '#3B82F6'; // Default Blue

            if (type === 'event' || type === 'selected') {
                color = '#EF4444'; // Red
            }
            if (type === 'itinerary') {
                color = '#EF4444'; // Red (User Request: "thing on the itinerary should all be red")
            }
            if (isSelected) {
                color = '#22C55E'; // Green
            }

            // SVG Paths
            const pinPath = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z";
            const foodPath = "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"; // Fork & Knife
            const hotelPath = "M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"; // Bed

            // Determine Path based on Type
            let path = pinPath;
            if (item.types && (item.types.includes('restaurant') || item.types.includes('food') || item.types.includes('meal_takeaway'))) {
                path = foodPath;
            } else if (item.types && (item.types.includes('lodging') || item.types.includes('hotel'))) {
                path = hotelPath;
            }

            const icon: google.maps.Symbol = {
                path: path,
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: '#FFFFFF',
                anchor: path === pinPath ? new google.maps.Point(12, 22) : new google.maps.Point(12, 12), // Adjust anchor for square icons
                scale: isSelected ? 1.5 : 1.2, // Slightly smaller scale for complex icons
            };

            const marker = new google.maps.Marker({
                position,
                map,
                title,
                icon: icon,
                zIndex: isSelected ? 999 : 1,
                animation: google.maps.Animation.DROP
            });

            // Add click listener
            if (type === 'place' && onSelectPlace) {
                marker.addListener('click', () => {
                    onSelectPlace(item);
                });
            }

            markersRef.current.push(marker);
            bounds.extend(position);
            hasPoints = true;
        };

        // 1. Add Selected Event
        if (selectedEvent && selectedEvent.location) {
            addMarker(selectedEvent, `event: ${selectedEvent.name}`, 'event');
        }

        // 2. Add Itinerary Items
        itinerary.forEach(item => {
            addMarker(item, `Itinerary: ${item.name}`, 'itinerary');
        });

        // 3. Add Search Results
        // Events
        if (!selectedEvent && events.length > 0) {
            events.forEach(event => {
                addMarker(event, event.name, 'event');
            });
        }

        // Places
        if (places.length > 0) {
            places.forEach(place => {
                const isSelected = selectedPlace?.id === place.id;
                addMarker(place, place.name, 'place', isSelected);
            });
        }

        // Fit bounds
        if (hasPoints) {
            map.fitBounds(bounds);
        } else if (selectedEvent?.location) {
            map.setCenter(selectedEvent.location);
            map.setZoom(14);
        }

    }, [map, events, places, selectedEvent, selectedPlace, itinerary, onSelectPlace]);

    return (
        <div className="w-full h-full overflow-hidden relative bg-gray-100">
            <div ref={mapRef} className="w-full h-full min-h-[400px]" />
        </div>
    );
}
