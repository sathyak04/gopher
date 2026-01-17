'use client';

import { useState, useRef, useEffect } from 'react';

interface Event {
    id: string;
    name: string;
    date: string;
    time: string;
    venue: string;
    city: string;
    state: string;
    image: string;
    url: string;
    priceRange: string;
    location?: { lat: number; lng: number } | null;
}

interface Place {
    id: string;
    name: string;
    address: string;
    rating: number;
    userRatingsTotal: number;
    priceLevel?: number;
    priceLabel: string;
    types: string[];
    location: { lat: number; lng: number };
    photo: string | null;
    openNow?: boolean;
    distance?: string;
}

export default function Chat() {
    const [messages, setMessages] = useState<Array<{ role: string, content: string }>>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [events, setEvents] = useState<Event[]>([]);
    const [isSearchingEvents, setIsSearchingEvents] = useState(false);
    const [hasSearchedEvents, setHasSearchedEvents] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
    const [hasSearchedPlaces, setHasSearchedPlaces] = useState(false);
    const [waitingForConfirmation, setWaitingForConfirmation] = useState<'hotels' | 'hotels_filters' | null>(null);
    const [hotelFilters, setHotelFilters] = useState({ budget: 'moderate', radius: 8000, rating: 3 });
    const [itinerary, setItinerary] = useState<Array<Event | Place>>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // ... (rest of code)

    /* I will assume the rest of the file is unchanged until confirmHotels. 
       I cannot easily jump to confirmHotels in this single replace call without context.
       So I will do State here. And functions in next call.
    */

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, events, places]);

    const searchEvents = async (keyword: string) => {
        setIsSearchingEvents(true);
        setHasSearchedEvents(false);
        try {
            const response = await fetch(`/api/events?keyword=${encodeURIComponent(keyword)}`);
            const data = await response.json();
            if (data.events && data.events.length > 0) {
                setEvents(data.events);
            } else {
                setEvents([]);
            }
        } catch (error) {
            console.error('Error searching events:', error);
            setEvents([]);
        } finally {
            setIsSearchingEvents(false);
            setHasSearchedEvents(true);
        }
    };

    const getPriceEstimate = (level: number, type: string) => {
        if (type === 'hotel') {
            const prices = ['<$100', '$100-160', '$160-250', '$250-400', '$400+'];
            return prices[level] || 'Price Varies';
        } else {
            const prices = ['<$15', '$15-30', '$30-60', '$60+', 'Price Varies'];
            return prices[level] || 'Price Varies';
        }
    };

    const searchPlaces = async (params: { type: string; budget: string; rating: number; radius: number }) => {
        setIsSearchingPlaces(true);
        setHasSearchedPlaces(false);

        if (!selectedEvent?.location) {
            console.warn('No event location available - Venue likely TBD');
            setIsSearchingPlaces(false);
            setHasSearchedPlaces(true); // Triggers the "Venue TBD" warning in UI
            return;
        }
        try {
            const maxPrice = params.budget === 'cheap' ? 1 : params.budget === 'moderate' ? 2 : 4;
            const types = params.type.split(',').map(t => t.trim());
            const allPlaces: Place[] = [];

            for (const placeType of types) {
                // Unified Google Places Search (Hotels & Restaurants) with Price Estimates
                const apiType = placeType === 'hotel' ? 'lodging' : 'restaurant';

                const url = `/api/places?lat=${selectedEvent.location.lat}&lng=${selectedEvent.location.lng}&type=${apiType}&radius=${params.radius}&minRating=${params.rating}&maxPrice=${maxPrice}`;

                console.log(`Searching Google Places for ${apiType}...`);
                const response = await fetch(url);
                const data = await response.json();

                if (data.places) {
                    // Enrich with price estimates based on Google Price Level
                    const enrichedPlaces = data.places.map((p: any) => ({
                        ...p,
                        priceLabel: p.priceLevel !== undefined
                            ? `${p.priceLabel} (${getPriceEstimate(p.priceLevel, placeType)})`
                            : 'Price varies'
                    }));
                    allPlaces.push(...enrichedPlaces);
                }
            }

            setPlaces(allPlaces);
        } catch (error) {
            console.error('Error searching places:', error);
            setPlaces([]);
        } finally {
            setIsSearchingPlaces(false);
            setHasSearchedPlaces(true);
        }
    };

    const searchPlacesOld = async (params: { type: string; budget: string; rating: number; radius: number }) => {
        if (!selectedEvent?.location) {
            console.error('No event location available');
            return;
        }

        setIsSearchingPlaces(true);
        setHasSearchedPlaces(false);
        try {
            const maxPrice = params.budget === 'cheap' ? 1 : params.budget === 'moderate' ? 2 : 4;
            const types = params.type.split(',').map(t => t.trim());
            const allPlaces: Place[] = [];

            for (const placeType of types) {
                if (placeType === 'hotel') {
                    // Use Amadeus API for hotels (real prices)
                    const radiusKm = Math.round(params.radius / 1000); // Convert meters to km
                    const url = `/api/hotels?lat=${selectedEvent.location.lat}&lng=${selectedEvent.location.lng}&radius=${radiusKm}`;

                    console.log('Fetching hotels from Amadeus...');
                    const response = await fetch(url);
                    const data = await response.json();

                    if (data.hotels && data.hotels.length > 0) {
                        // Transform Amadeus hotels to our Place format
                        const hotels: Place[] = data.hotels.map((h: any) => ({
                            id: h.id,
                            name: h.name,
                            address: h.address || h.city || '',
                            rating: h.rating || 0,
                            userRatingsTotal: 0,
                            priceLevel: h.price ? Math.ceil(h.price / 100) : undefined,
                            priceLabel: h.priceLabel || 'Price N/A',
                            types: ['hotel'],
                            location: h.location || { lat: 0, lng: 0 },
                            photo: null,
                            openNow: true,
                        }));
                        allPlaces.push(...hotels);
                    } else {
                        console.log('Amadeus returned no hotels, falling back to Google Places...');
                        const googleUrl = `/api/places?lat=${selectedEvent.location.lat}&lng=${selectedEvent.location.lng}&type=lodging&radius=${params.radius}&minRating=${params.rating}&maxPrice=${maxPrice}`;
                        const gResponse = await fetch(googleUrl);
                        const gData = await gResponse.json();
                        if (gData.places) {
                            allPlaces.push(...gData.places);
                        }
                    }
                } else {
                    // Use Google Places for restaurants
                    const url = `/api/places?lat=${selectedEvent.location.lat}&lng=${selectedEvent.location.lng}&type=restaurant&radius=${params.radius}&minRating=${params.rating}&maxPrice=${maxPrice}`;

                    const response = await fetch(url);
                    const data = await response.json();

                    if (data.places) {
                        allPlaces.push(...data.places);
                    }
                }
            }

            setPlaces(allPlaces);
        } catch (error) {
            console.error('Error searching places:', error);
            setPlaces([]);
        } finally {
            setIsSearchingPlaces(false);
            setHasSearchedPlaces(true);
        }
    };

    // Parse [FIND_PLACES] command from AI response
    const checkForPlacesTrigger = (text: string): boolean => {
        const placesMatch = text.match(/\[FIND_PLACES:\s*(.+?)\]/i);
        if (placesMatch) {
            // Check if we have a selected event with location BEFORE parsing
            if (!selectedEvent?.location) {
                console.warn('Cannot search places: No event location available for selected event:', selectedEvent);
                // Don't add messages here - just return false and let the AI response show
                return false;
            }

            const paramsStr = placesMatch[1];
            const params: any = { type: 'restaurant', budget: 'moderate', rating: 0, radius: 1500 };

            // Parse parameters
            paramsStr.split('|').forEach(part => {
                const [key, value] = part.split('=').map(s => s.trim());
                if (key === 'type') params.type = value;
                if (key === 'budget') params.budget = value;
                if (key === 'rating') params.rating = parseFloat(value) || 0;
                if (key === 'radius') params.radius = parseInt(value) || 1500;
            });

            console.log('Searching places with params:', params, 'from location:', selectedEvent.location);
            searchPlaces(params);
            return true;
        }
        return false;
    };

    // Check AI response for search trigger
    const checkForSearchTrigger = (text: string) => {
        const searchMatch = text.match(/\[SEARCH_EVENT:\s*(.+?)\]/i);
        if (searchMatch) {
            const keyword = searchMatch[1].trim();
            searchEvents(keyword);
            return keyword;
        }
        return null;
    };

    // Check for [ASK_HOTELS] trigger
    const checkForAskHotelsTrigger = (text: string) => {
        if (text.includes('[ASK_HOTELS]')) {
            setWaitingForConfirmation('hotels');
            return true;
        }
        return false;
    };

    // Clean the search triggers from display text
    const cleanDisplayText = (text: string) => {
        return text
            .replace(/\[SEARCH_EVENT:\s*.+?\]/gi, '')
            .replace(/\[FIND_PLACES:\s*.+?\]/gi, '')
            .replace(/\[ASK_HOTELS\]/gi, '')
            .trim();
    };


    const handleEventSelect = (event: Event) => {
        console.log('Selected event:', event);
        console.log('Event location:', event.location);
        setSelectedEvent(event);
        setEvents([]);
        setPlaces([]); // Clear any previous places
        setWaitingForConfirmation(null); // Clear any pending confirmations

        const eventMessage = {
            role: 'user',
            content: `I want to attend: ${event.name} at ${event.venue} in ${event.city}, ${event.state} on ${event.date}`
        };

        const newMessages = [...messages, eventMessage];
        setMessages(newMessages);
        sendToAI(newMessages);
    };

    const handlePlaceSelect = (place: Place) => {
        // Add to itinerary
        setItinerary(prev => [...prev, place]);

        // Remove from places list
        setPlaces(prev => prev.filter(p => p.id !== place.id));

        // Let AI know
        const placeMessage = {
            role: 'user',
            content: `I'd like to add ${place.name} (${place.priceLabel}, ${place.rating}⭐) to my itinerary.`
        };

        const newMessages = [...messages, placeMessage];
        setMessages(newMessages);
        sendToAI(newMessages);
    };

    const sendToAI = async (messagesToSend: Array<{ role: string, content: string }>) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messagesToSend }),
            });

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = { role: 'assistant', content: '' };
            let fullResponse = '';
            let searchTriggered = false;
            let placesTriggered = false;
            let askHotelsTriggered = false;

            setMessages(prev => [...prev, assistantMessage]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                fullResponse += text;

                // Check for triggers
                if (!searchTriggered) {
                    const searchKeyword = checkForSearchTrigger(fullResponse);
                    if (searchKeyword) searchTriggered = true;
                }
                if (!placesTriggered) {
                    console.log('Checking for places trigger in:', fullResponse.substring(0, 200));
                    if (checkForPlacesTrigger(fullResponse)) {
                        console.log('PLACES TRIGGER FOUND!');
                        placesTriggered = true;
                    }
                }
                if (!askHotelsTriggered) {
                    if (checkForAskHotelsTrigger(fullResponse)) {
                        askHotelsTriggered = true;
                    }
                }

                assistantMessage.content = cleanDisplayText(fullResponse);

                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...assistantMessage };
                    return updated;
                });
            }
        } catch (error) {
            console.error('Chat error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickReply = (text: string) => {
        if (isLoading) return;
        const userMessage = { role: 'user', content: text };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        sendToAI(newMessages);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];

        setMessages(newMessages);
        setInput('');
        setEvents([]);

        sendToAI(newMessages);
    };

    const confirmHotels = (confirmed: boolean) => {
        if (confirmed) {
            setWaitingForConfirmation('hotels_filters');
        } else {
            setWaitingForConfirmation(null);
            handleQuickReply("No, I'll search for something else.");
        }
    };

    const executeFilteredSearch = () => {
        setWaitingForConfirmation(null);

        // Add User Message for context
        const filterMsg = `Searching for hotels: ${hotelFilters.budget === 'cheap' ? '$' : hotelFilters.budget === 'moderate' ? '$$' : '$$$'}, ${(hotelFilters.radius / 1600).toFixed(0)} mi, ${hotelFilters.rating}+ stars`;
        const userMessage = { role: 'user', content: filterMsg };
        setMessages(prev => [...prev, userMessage]);

        // Trigger Search Directly
        searchPlaces({
            type: 'hotel',
            budget: hotelFilters.budget,
            rating: hotelFilters.rating,
            radius: hotelFilters.radius
        });
    };

    const formatDate = (date: string) => {
        if (!date || date === 'TBD') return 'Date TBD';
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="flex flex-col w-full max-w-4xl py-8 mx-auto">
            {/* Chat Messages */}
            <div className="space-y-4 mb-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">🎫 Event Trip Planner</h2>
                        <p>Tell me about an event or artist you want to see!</p>
                        <p className="text-sm mt-2">Example: "I want to see Taylor Swift" or "Find Lakers games"</p>
                    </div>
                )}
                {messages.map((m, index) => (
                    <div key={index} className={`p-4 rounded-lg ${m.role === 'user' ? 'bg-blue-100 ml-8' : 'bg-white shadow mr-8'}`}>
                        <div className="font-semibold text-sm text-gray-600 mb-1">
                            {m.role === 'user' ? '👤 You' : '🤖 AI Assistant'}
                        </div>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Event Search Results */}
            {isSearchingEvents && (
                <div className="text-center py-4 text-gray-500">
                    <div className="animate-pulse">🔍 Searching for events...</div>
                </div>
            )}

            {!selectedEvent && !isSearchingEvents && hasSearchedEvents && events.length === 0 && (
                <div className="text-center py-4 text-red-500 bg-red-50 rounded-lg border border-red-200 mb-4 animate-fadeIn">
                    <p>❌ No events found matching your request.</p>
                    <p className="text-sm text-gray-600 mt-1">Try a different artist name or city.</p>
                </div>
            )}

            {events.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">
                        🎭 Found {events.length} events - Click one to plan your trip:
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                        {events.map((event) => (
                            <div
                                key={event.id}
                                onClick={() => handleEventSelect(event)}
                                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-blue-500 overflow-hidden"
                            >
                                {event.image && (
                                    <img src={event.image} alt={event.name} className="w-full h-32 object-cover" />
                                )}
                                <div className="p-3">
                                    <h4 className="font-bold text-gray-800 truncate">{event.name}</h4>
                                    <p className="text-sm text-gray-600">📅 {formatDate(event.date)}</p>
                                    <p className="text-sm text-gray-600">📍 {event.venue}</p>
                                    <p className="text-sm text-gray-500">{event.city}, {event.state}</p>
                                    <p className="text-sm font-semibold text-green-600 mt-1">{event.priceRange}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Places Search Results */}
            {isSearchingPlaces && (
                <div className="text-center py-4 text-gray-500">
                    <div className="animate-pulse">🔍 Finding nearby restaurants & hotels...</div>
                </div>
            )}

            {!isSearchingPlaces && hasSearchedPlaces && places.length === 0 && (
                <div className="text-center py-4 text-red-500 bg-red-50 rounded-lg border border-red-200 mb-4">
                    {selectedEvent && !selectedEvent.location ? (
                        <p>⚠️ Cannot find places: The event venue is "TBD" and has no location yet.</p>
                    ) : (
                        <div>
                            <p>❌ No places found matching your criteria.</p>
                            <p className="text-sm text-gray-600 mt-1">Try increasing the radius or changing the filters.</p>
                        </div>
                    )}
                </div>
            )}

            {places.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">
                        🏨 Found {places.length} nearby places - Click to add to itinerary:
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                        {places.map((place) => {
                            const isHotel = place.types?.includes('hotel') || place.types?.includes('lodging');
                            return (
                                <div
                                    key={place.id}
                                    onClick={() => handlePlaceSelect(place)}
                                    className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-green-500 overflow-hidden"
                                >
                                    {place.photo && (
                                        <img src={place.photo} alt={place.name} className="w-full h-32 object-cover" />
                                    )}
                                    {!place.photo && isHotel && (
                                        <div className="w-full h-24 bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-4xl">
                                            🏨
                                        </div>
                                    )}
                                    <div className="p-3">
                                        <h4 className="font-bold text-gray-800 truncate">{place.name}</h4>
                                        <div className="flex items-center gap-2 text-sm flex-wrap">
                                            {isHotel && place.rating > 0 && (
                                                <span className="text-yellow-500 font-semibold">
                                                    {'★'.repeat(place.rating)}{'☆'.repeat(5 - place.rating)}
                                                </span>
                                            )}
                                            {!isHotel && place.rating > 0 && (
                                                <>
                                                    <span className="text-yellow-500">⭐ {place.rating}</span>
                                                    {place.userRatingsTotal > 0 && (
                                                        <span className="text-gray-400">({place.userRatingsTotal})</span>
                                                    )}
                                                </>
                                            )}
                                            {!isHotel && (
                                                <span className="text-green-600 font-bold text-base">{place.priceLabel}</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 truncate">📍 {place.address || 'Address N/A'}</p>

                                        {isHotel && (
                                            <a
                                                href={`https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(place.name + ' ' + (place.address || ''))}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 inline-block bg-blue-600 text-white text-xs px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                Book on Expedia ↗
                                            </a>
                                        )}

                                        {!isHotel && place.openNow !== undefined && (
                                            <p className={`text-sm ${place.openNow ? 'text-green-600' : 'text-red-600'}`}>
                                                {place.openNow ? '✓ Open now' : '✗ Closed'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Selected Event Banner */}
            {selectedEvent && (
                <div className="mb-4 p-3 bg-green-100 rounded-lg border border-green-300 relative">
                    <button
                        onClick={() => setSelectedEvent(null)}
                        className="absolute top-2 right-2 text-green-700 hover:text-green-900 bg-green-200 hover:bg-green-300 rounded-full px-2 py-0.5 text-xs font-bold transition-colors"
                    >
                        Change Event
                    </button>
                    <div className="flex items-center gap-3">
                        {selectedEvent.image && (
                            <img src={selectedEvent.image} alt="" className="w-16 h-16 object-cover rounded" />
                        )}
                        <div>
                            <p className="font-semibold text-green-800">✅ Selected Event:</p>
                            <p className="text-sm text-green-700">{selectedEvent.name}</p>
                            <p className="text-xs text-green-600">{formatDate(selectedEvent.date)} • {selectedEvent.venue}</p>
                        </div>
                    </div>

                    {/* Manual Search Buttons Removed as per request */}
                </div>
            )}

            {/* Itinerary */}
            {itinerary.length > 0 && (
                <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h3 className="font-bold text-purple-800 mb-3">📋 Your Itinerary</h3>
                    <div className="space-y-2">
                        {selectedEvent && (
                            <div className="flex items-center gap-2 p-2 bg-white rounded border">
                                <span className="text-lg">🎫</span>
                                <div>
                                    <p className="font-semibold text-sm">{selectedEvent.name}</p>
                                    <p className="text-xs text-gray-500">{selectedEvent.venue}</p>
                                </div>
                            </div>
                        )}
                        {itinerary.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
                                <span className="text-lg">{'rating' in item ? '🍽️' : '🏨'}</span>
                                <div>
                                    <p className="font-semibold text-sm">{item.name}</p>
                                    <p className="text-xs text-gray-500">
                                        {'rating' in item && `⭐ ${(item as Place).rating} • ${(item as Place).priceLabel}`}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Form Replacement Logic */}
            <div className="sticky bottom-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                {waitingForConfirmation === 'hotels' ? (
                    <div className="flex flex-col items-center justify-center py-2 animate-fadeIn">
                        <p className="mb-3 font-semibold text-gray-700">Would you like to search for hotels nearby?</p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => confirmHotels(true)}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full font-bold transition-all transform hover:scale-105"
                            >
                                Yes, Find Hotels
                            </button>
                            <button
                                onClick={() => confirmHotels(false)}
                                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-full font-bold transition-all"
                            >
                                No, thanks
                            </button>
                        </div>
                    </div>
                ) : waitingForConfirmation === 'hotels_filters' ? (
                    <div className="bg-gray-50 p-4 rounded-lg animate-fadeIn border border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-700">🏨 Hotel Preferences</h3>
                            <button onClick={() => setWaitingForConfirmation(null)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>

                        <div className="space-y-4">
                            {/* Budget */}
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Budget</label>
                                <div className="flex gap-2 mt-1">
                                    {['cheap', 'moderate', 'expensive'].map((b) => (
                                        <button
                                            key={b}
                                            onClick={() => setHotelFilters(prev => ({ ...prev, budget: b }))}
                                            className={`flex-1 py-1 rounded text-sm font-bold border ${hotelFilters.budget === b ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                        >
                                            {b === 'cheap' ? '$' : b === 'moderate' ? '$$' : '$$$'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Distance */}
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Distance (Radius)</label>
                                <div className="flex gap-2 mt-1">
                                    {[8000, 16000, 32000].map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setHotelFilters(prev => ({ ...prev, radius: r }))}
                                            className={`flex-1 py-1 rounded text-sm font-bold border ${hotelFilters.radius === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                        >
                                            {(r / 1600).toFixed(0)} Miles
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Rating */}
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Min Rating</label>
                                <div className="flex gap-2 mt-1">
                                    {[3, 4, 5].map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setHotelFilters(prev => ({ ...prev, rating: r }))}
                                            className={`flex-1 py-1 rounded text-sm font-bold border ${hotelFilters.rating === r ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-gray-600 border-gray-300'}`}
                                        >
                                            {r}+ Stars
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={executeFilteredSearch}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-md transform active:scale-95 transition-all mt-2"
                            >
                                🔍 Search Hotels
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <input
                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={input}
                            placeholder="Chat or ask about an event (e.g., 'I want to see Taylor Swift')..."
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? '...' : 'Send'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
