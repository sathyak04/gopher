'use client';

import { useEffect, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

interface MapViewProps {
    center?: { lat: number; lng: number };
    zoom?: number;
    events?: any[];
    places?: any[];
    selectedEvent?: any | null;
    selectedPlace?: any | null;
    itinerary?: any[];
    onSelectPlace?: (place: any) => void;
}

export default function MapView({
    center = { lat: 34.0522, lng: -118.2437 },
    zoom = 12,
    events = [],
    places = [],
    selectedEvent = null,
    selectedPlace = null,
    itinerary = [],
    onSelectPlace
}: MapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);

    useEffect(() => {
        const initMap = async () => {
            // Configure the loader
            setOptions({
                apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY as string,
                version: 'weekly',
                libraries: ['places']
            });

            try {
                // Import the Maps library using the functional API
                const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;

                // Use selected event location if available, otherwise default center
                const initialCenter = selectedEvent?.location || center;

                const newMap = new Map(mapRef.current as HTMLElement, {
                    center: initialCenter,
                    zoom: zoom,
                    // mapId: 'DEMO_MAP_ID', // Removed to fix ApiProjectMapError
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
        }
    }, [map, center, zoom, selectedEvent]);

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
                color = '#581c87'; // Dark Purple
            }
            if (isSelected) {
                color = '#22C55E'; // Green
            }

            // SVG Path for a Pin with a hole
            const pinPath = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z";

            const icon: google.maps.Symbol = {
                path: pinPath,
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: '#FFFFFF',
                anchor: new google.maps.Point(12, 22), // Tip of the pin (approx)
                scale: isSelected ? 2.5 : 1.8, // Scale up SVG
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
