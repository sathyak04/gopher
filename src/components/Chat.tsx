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
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
    const [itinerary, setItinerary] = useState<Array<Event | Place>>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, events, places]);

    const searchEvents = async (keyword: string) => {
        setIsSearchingEvents(true);
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
        }
    };

    const searchPlaces = async (params: { type: string; budget: string; rating: number; radius: number }) => {
        if (!selectedEvent?.location) {
            console.error('No event location available');
            return;
        }

        setIsSearchingPlaces(true);
        try {
            // Map budget to price level
            const maxPrice = params.budget === 'cheap' ? 1 : params.budget === 'moderate' ? 2 : 4;

            const types = params.type.split(',').map(t => t.trim());
            const allPlaces: Place[] = [];

            for (const placeType of types) {
                const googleType = placeType === 'hotel' ? 'lodging' : 'restaurant';
                const url = `/api/places?lat=${selectedEvent.location.lat}&lng=${selectedEvent.location.lng}&type=${googleType}&radius=${params.radius}&minRating=${params.rating}&maxPrice=${maxPrice}`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.places) {
                    allPlaces.push(...data.places);
                }
            }

            setPlaces(allPlaces);
        } catch (error) {
            console.error('Error searching places:', error);
            setPlaces([]);
        } finally {
            setIsSearchingPlaces(false);
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

    // Clean the search triggers from display text
    const cleanDisplayText = (text: string) => {
        return text
            .replace(/\[SEARCH_EVENT:\s*.+?\]/gi, '')
            .replace(/\[FIND_PLACES:\s*.+?\]/gi, '')
            .trim();
    };


    const handleEventSelect = (event: Event) => {
        console.log('Selected event:', event);
        console.log('Event location:', event.location);
        setSelectedEvent(event);
        setEvents([]);
        setPlaces([]); // Clear any previous places

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
                    if (checkForPlacesTrigger(fullResponse)) placesTriggered = true;
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

            {places.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">
                        🍽️ Found {places.length} nearby places - Click to add to itinerary:
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                        {places.map((place) => (
                            <div
                                key={place.id}
                                onClick={() => handlePlaceSelect(place)}
                                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-green-500 overflow-hidden"
                            >
                                {place.photo && (
                                    <img src={place.photo} alt={place.name} className="w-full h-32 object-cover" />
                                )}
                                <div className="p-3">
                                    <h4 className="font-bold text-gray-800 truncate">{place.name}</h4>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-yellow-500">⭐ {place.rating}</span>
                                        <span className="text-gray-400">({place.userRatingsTotal})</span>
                                        <span className="text-green-600 font-semibold">{place.priceLabel}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 truncate">📍 {place.address}</p>
                                    {place.openNow !== undefined && (
                                        <p className={`text-sm ${place.openNow ? 'text-green-600' : 'text-red-600'}`}>
                                            {place.openNow ? '✓ Open now' : '✗ Closed'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Selected Event Banner */}
            {selectedEvent && (
                <div className="mb-4 p-3 bg-green-100 rounded-lg border border-green-300">
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

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="sticky bottom-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                <div className="flex gap-2">
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
                </div>
            </form>
        </div>
    );
}
