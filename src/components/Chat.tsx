'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import MapView from './MapView';

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

const getPlaceEmoji = (types: string[] = []) => {
    if (!types) return '📍';
    if (types.includes('lodging') || types.includes('hotel')) return '🏨';
    if (types.includes('restaurant') || types.includes('food') || types.includes('meal_takeaway') || types.includes('cafe')) return '🍽️';
    if (types.includes('park') || types.includes('campground') || types.includes('natural_feature')) return '🌳';
    if (types.includes('movie_theater') || types.includes('cinema')) return '🎬';
    if (types.includes('museum') || types.includes('art_gallery')) return '🖼️';
    if (types.includes('shopping_mall') || types.includes('store') || types.includes('clothing_store')) return '🛍️';
    if (types.includes('night_club') || types.includes('bar')) return '🍸';
    if (types.includes('spa') || types.includes('gym') || types.includes('health')) return '💆';
    if (types.includes('tourist_attraction')) return '📸';
    return '📍';
};

const PlaceImage = ({ place }: { place: Place }) => {
    const [imgError, setImgError] = useState(false);

    if (place.photo && !imgError) {
        return (
            <img
                src={place.photo}
                alt={place.name}
                className="w-full sm:w-32 h-32 object-cover"
                onError={() => setImgError(true)}
            />
        );
    }

    return (
        <div className="w-full sm:w-32 h-32 bg-gray-200 flex items-center justify-center text-4xl">
            {getPlaceEmoji(place.types)}
        </div>
    );
};

export default function Chat() {
    const [messages, setMessages] = useState<Array<{ role: string, content: string }>>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [events, setEvents] = useState<Event[]>([]);
    const [isSearchingEvents, setIsSearchingEvents] = useState(false);
    const [hasSearchedEvents, setHasSearchedEvents] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    // Separate Results States
    const [hotelResults, setHotelResults] = useState<Place[]>([]);
    const [restaurantResults, setRestaurantResults] = useState<Place[]>([]);
    const [exploreResults, setExploreResults] = useState<Place[]>([]);

    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);

    // UI State for Collapsible Sections
    const [isHotelsExpanded, setIsHotelsExpanded] = useState(true);

    // Updated States for Advanced Filters
    const [waitingForConfirmation, setWaitingForConfirmation] = useState<'event' | 'hotels' | 'hotels_filters' | 'food' | 'food_filters' | 'explore' | 'explore_filters' | null>(null);
    const [hasSearchedPlaces, setHasSearchedPlaces] = useState(false);
    const [hotelFilters, setHotelFilters] = useState({ radius: 8000 });
    const [foodFilters, setFoodFilters] = useState({
        locationPreference: 'venue' as 'venue' | 'hotel',
        radius: 8000,
        cuisine: ''
    });
    const [exploreFilters, setExploreFilters] = useState({
        locationPreference: 'venue' as 'venue' | 'hotel',
        radius: 8000,
        activity: ''
    });

    // Feature Flags & UI State


    const [itinerary, setItinerary] = useState<Array<Event | Place>>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, events]); // Only scroll on new messages or events, not on place results

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

    const searchPlaces = async (params: { type: string; radius: number; keyword?: string; center?: { lat: number; lng: number } }) => {
        setIsSearchingPlaces(true);

        const searchCenter = params.center || selectedEvent?.location;

        if (!searchCenter) {
            console.warn('Cannot search places: No location available');
            setIsSearchingPlaces(false);
            return;
        }

        // Determine which list to update based on request type
        const isHotelSearch = params.type.includes('hotel') || params.type.includes('lodging');

        if (isHotelSearch) {
            setHotelResults([]);
            setIsHotelsExpanded(true); // Auto-expand when searching hotels
        } else {
            setRestaurantResults([]);
            setIsHotelsExpanded(false); // Auto-collapse hotels when searching food
        }

        try {
            const types = params.type.split(',').map(t => t.trim());
            const allPlaces: Place[] = [];

            for (const placeType of types) {
                const apiType = placeType === 'hotel' ? 'lodging' : 'restaurant';
                const url = `/api/places?lat=${searchCenter.lat}&lng=${searchCenter.lng}&type=${apiType}&radius=${params.radius}&minRating=0&keyword=${encodeURIComponent(params.keyword || '')}`;

                console.log(`Searching Google Places for ${apiType} at`, searchCenter);
                const response = await fetch(url);
                const data = await response.json();

                if (data.places) {
                    const googlePlaces = data.places.map((p: any) => ({ ...p }));
                    allPlaces.push(...googlePlaces);
                }
            }

            if (isHotelSearch) {
                setHotelResults(allPlaces);
            } else {
                setRestaurantResults(allPlaces);
            }

        } catch (error) {
            console.error('Error searching places:', error);
            if (isHotelSearch) setHotelResults([]); else setRestaurantResults([]);
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
            const params: any = { type: 'restaurant', radius: 1500 };

            // Parse parameters
            paramsStr.split('|').forEach(part => {
                const [key, value] = part.split('=').map(s => s.trim());
                if (key === 'type') params.type = value;
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

    // Check for [CONFIRM_EVENT] trigger
    const checkForConfirmTrigger = (text: string) => {
        if (text.includes('[CONFIRM_EVENT]')) {
            setWaitingForConfirmation('event');
            return true;
        }
        return false;
    };

    // Clean the search triggers from display text
    const cleanDisplayText = (text: string) => {
        return text
            .replace(/\[SEARCH_EVENT:\s*.+?\]/gi, '')
            .replace(/\[FIND_PLACES:\s*.+?\]/gi, '')
            .replace(/\[SEARCH_EVENT:\s*.+?\]/gi, '')
            .replace(/\[FIND_PLACES:\s*.+?\]/gi, '')
            .replace(/\[ASK_HOTELS\]/gi, '')
            .trim();
    };


    const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);


    const handleEventSelect = (event: Event) => {
        setHighlightedEventId(event.id);
        // Visual highlight only, do not set selectedEvent yet
    };

    const handleEventConfirm = (event: Event) => {
        console.log('Confirmed event:', event);
        setSelectedEvent(event);
        setHighlightedEventId(null);
        setEvents([]); // Hide list
        setHotelResults([]);
        setRestaurantResults([]);
        setWaitingForConfirmation(null);

        const eventMessage = {
            role: 'user',
            content: `I want to attend: ${event.name} at ${event.venue} in ${event.city}, ${event.state} on ${event.date}`
        };

        const newMessages = [...messages, eventMessage];
        setMessages(newMessages);
        sendToAI(newMessages);
    };

    const handlePlaceSelect = (place: Place) => {
        setSelectedPlace(place);
    };

    const handlePlaceConfirm = (place: Place) => {
        // Add to itinerary
        setItinerary(prev => [...prev, place]);
        setSelectedPlace(null);

        const isHotel = place.types?.includes('lodging') || place.types?.includes('hotel');
        const isFromExplore = exploreResults.some(p => p.id === place.id);

        // Remove from correct list
        if (isHotel) {
            setHotelResults(prev => prev.filter(p => p.id !== place.id));
        } else if (isFromExplore) {
            setExploreResults(prev => prev.filter(p => p.id !== place.id));
        } else {
            setRestaurantResults(prev => prev.filter(p => p.id !== place.id));
        }

        // Let AI know
        const placeMessage = {
            role: 'user',
            content: `I'd like to add ${place.name} to my itinerary.`
        };

        const newMessages = [...messages, placeMessage];
        setMessages(newMessages);
        sendToAI(newMessages);

        // Check if it was a hotel to trigger Food prompt, otherwise trigger Explore prompt
        // Don't trigger explore if already exploring
        if (isHotel) {
            setWaitingForConfirmation('food');
        } else if (!isFromExplore) {
            // For restaurants (not from explore), prompt to explore activities
            setWaitingForConfirmation('explore');
        }
        // If from explore, just stay in explore_filters or clear
    };

    const confirmFood = (confirmed: boolean) => {
        if (confirmed) {
            setWaitingForConfirmation('food_filters'); // Updated state
            // Reset filters logic
            setFoodFilters(prev => ({ ...prev, locationPreference: 'venue', radius: 1600, cuisine: '' }));
        } else {
            setWaitingForConfirmation(null);
            handleQuickReply("No thanks, I'm good on food.");
        }
    };

    const executeFoodSearch = () => {
        const cuisine = foodFilters.cuisine;
        if (!cuisine.trim()) return;
        setWaitingForConfirmation('food_filters'); // Keep filters open

        // Determine Center
        let searchCenter = selectedEvent?.location;
        let locationName = "the venue";

        if (foodFilters.locationPreference === 'hotel') {
            // Find last hotel in itinerary
            const hotel = itinerary.slice().reverse().find(i => 'types' in i && (i.types.includes('lodging') || i.types.includes('hotel'))) as Place | undefined;
            if (hotel && hotel.location) {
                searchCenter = hotel.location;
                locationName = hotel.name;
            } else {
                console.warn('No hotel found in itinerary, defaulting to venue');
            }
        }

        const searchQuery = `${cuisine} restaurants`;
        const userMessage = {
            role: 'user',
            content: `Find me ${searchQuery} near ${locationName} (within ${(foodFilters.radius / 1600).toFixed(1)} miles).`
        };
        setMessages(prev => [...prev, userMessage]);

        searchPlaces({
            type: 'restaurant',
            radius: foodFilters.radius,
            keyword: cuisine,
            center: searchCenter || undefined
        });
    };

    const confirmExplore = (confirmed: boolean) => {
        if (confirmed) {
            setWaitingForConfirmation('explore_filters');
            setExploreFilters(prev => ({ ...prev, locationPreference: 'venue', radius: 8000, activity: '' }));
        } else {
            setWaitingForConfirmation(null);
            handleQuickReply("No thanks, I'm done planning.");
        }
    };

    const executeExploreSearch = () => {
        const activity = exploreFilters.activity;
        if (!activity.trim()) return;
        setWaitingForConfirmation('explore_filters'); // Keep filters open

        // Determine Center
        let searchCenter = selectedEvent?.location;
        let locationName = "the venue";

        if (exploreFilters.locationPreference === 'hotel') {
            const hotel = itinerary.slice().reverse().find(i => 'types' in i && (i.types.includes('lodging') || i.types.includes('hotel'))) as Place | undefined;
            if (hotel && hotel.location) {
                searchCenter = hotel.location;
                locationName = hotel.name;
            } else {
                console.warn('No hotel found in itinerary, defaulting to venue');
            }
        }

        const userMessage = {
            role: 'user',
            content: activity === 'Popular'
                ? `Find me the most popular things to do near ${locationName} (within ${(exploreFilters.radius / 1600).toFixed(1)} miles).`
                : `Find me ${activity} near ${locationName} (within ${(exploreFilters.radius / 1600).toFixed(1)} miles).`
        };
        setMessages(prev => [...prev, userMessage]);

        // Clear previous explore results
        setExploreResults([]);
        setIsSearchingPlaces(true);

        // Search using a general type with the activity as keyword
        const searchExplore = async () => {
            if (!searchCenter) {
                console.warn('No search center available');
                setIsSearchingPlaces(false);
                return;
            }

            try {
                // Map common activities to Google Places types
                const activityLower = activity.toLowerCase();
                let placeType = 'tourist_attraction';
                let searchKeyword = activity;

                if (activity === 'Popular') {
                    placeType = 'tourist_attraction';
                    searchKeyword = ''; // Don't filter by keyword for popular to get top rated stuff
                } else if (activityLower.includes('movie') || activityLower.includes('cinema') || activityLower.includes('theater')) {
                    placeType = 'movie_theater';
                } else if (activityLower.includes('hik') || activityLower.includes('park') || activityLower.includes('nature')) {
                    placeType = 'park';
                } else if (activityLower.includes('museum') || activityLower.includes('art') || activityLower.includes('gallery')) {
                    placeType = 'museum';
                } else if (activityLower.includes('shop') || activityLower.includes('mall')) {
                    placeType = 'shopping_mall';
                } else if (activityLower.includes('bar') || activityLower.includes('club') || activityLower.includes('nightlife')) {
                    placeType = 'night_club';
                } else if (activityLower.includes('spa') || activityLower.includes('wellness')) {
                    placeType = 'spa';
                } else if (activityLower.includes('gym') || activityLower.includes('fitness')) {
                    placeType = 'gym';
                } else if (activityLower.includes('hotel') || activityLower.includes('lodging')) {
                    placeType = 'lodging';
                } else if (activityLower.includes('food') || activityLower.includes('restaurant') || activityLower.includes('eat')) {
                    placeType = 'restaurant';
                }

                const url = `/api/places?lat=${searchCenter.lat}&lng=${searchCenter.lng}&type=${placeType}&radius=${exploreFilters.radius}&minRating=0&keyword=${encodeURIComponent(searchKeyword)}`;

                console.log(`Exploring ${activity} (type: ${placeType}) at`, searchCenter);
                const response = await fetch(url);
                const data = await response.json();

                if (data.places) {
                    setExploreResults(data.places);
                } else {
                    setExploreResults([]);
                }
            } catch (error) {
                console.error('Error searching explore:', error);
                setExploreResults([]);
            } finally {
                setIsSearchingPlaces(false);
                setHasSearchedPlaces(true);
            }
        };

        searchExplore();
    };



    const removeFromItinerary = (id: string) => {
        setItinerary(prev => prev.filter(item => item.id !== id));
    };

    const handleItinerarySubmission = async () => {
        if (!selectedEvent && itinerary.length === 0) return;

        const mainEvent = selectedEvent
            ? `Main Event: ${selectedEvent.name} at ${selectedEvent.venue} on ${selectedEvent.date} at ${selectedEvent.time}.`
            : "No main event selected.";

        const itineraryItems = itinerary.map((item, index) => {
            const type = 'types' in item && (item.types.includes('lodging') || item.types.includes('hotel'))
                ? 'Hotel'
                : 'types' in item && item.types.includes('restaurant')
                    ? 'Restaurant'
                    : 'Activity';
            return `${index + 1}. ${item.name} (${type}) - ${item.address || 'No address'}`;
        }).join('\n');

        const prompt = `
I have planned the following itinerary:

${mainEvent}

My curated list of places:
${itineraryItems}

Please create a detailed, time-based schedule for my trip.
- Start from arrival (or reasonable morning time).
- Include travel time estimates between locations.
- Suggest logical gaps where I might need rest or additional activities.
- Ensure I arrive at the main event on time.
- If I'm missing meals or a hotel, please politely suggest adding them.
- Be conversational and ask for my feedback if you're unsure about timing.

Goal: A complete, optimized itinerary plan.
        `;

        const userMessage = { role: 'user', content: prompt };
        setMessages(prev => [...prev, userMessage]);

        // Ensure the prompt is sent to the AI
        sendToAI([...messages, userMessage]);
        setTimeout(() => scrollToBottom(), 200);
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
                if (!checkForConfirmTrigger(fullResponse)) {
                    // Just check
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
        sendToAI(newMessages);
    };

    const confirmHotels = (confirmed: boolean) => {
        if (confirmed) {
            setWaitingForConfirmation('hotels_filters');
            // handleQuickReply("Yes, please find hotels."); // Optional: verify filters
        } else {
            setWaitingForConfirmation(null);
            handleQuickReply("No, I'm good on hotels.");
        }
    };

    const executeFilteredSearch = () => {
        setWaitingForConfirmation(null);

        // Add User Message for context
        const filterMsg = `Searching for hotels: ${(hotelFilters.radius / 1600).toFixed(0)} mi radius`;
        const userMessage = { role: 'user', content: filterMsg };
        setMessages(prev => [...prev, userMessage]);

        // Trigger Search Directly
        searchPlaces({
            type: 'hotel',
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

    // -- RENDER HELPER: Places Grid --
    const renderPlacesGrid = (placesList: Place[], isHotel: boolean) => (
        <div className="grid grid-cols-1 gap-4">
            {placesList.map((place) => {
                return (
                    <div
                        key={place.id}
                        onClick={() => handlePlaceSelect(place)}
                        onDoubleClick={() => handlePlaceConfirm(place)}
                        className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer border-2 overflow-hidden flex flex-col sm:flex-row ${selectedPlace?.id === place.id ? 'border-green-500 ring-2 ring-green-300 transform scale-[1.01]' : 'border-transparent hover:border-green-500'
                            }`}
                    >
                        <PlaceImage place={place} />
                        <div className="p-3 flex-1 min-w-0">
                            <h4 className="font-bold text-gray-800 truncate">{place.name}</h4>
                            <div className="flex items-center gap-2 text-sm flex-wrap mt-1">
                                {isHotel && place.rating > 0 && (
                                    <span className="text-yellow-500 font-semibold tracking-wide">
                                        {'★'.repeat(Math.round(place.rating))}{'☆'.repeat(5 - Math.round(place.rating))}
                                        <span className="text-gray-400 font-normal ml-1">({place.rating})</span>
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
                            </div>

                            <p className="text-sm text-gray-600 truncate mt-1">📍 {place.address || 'Address N/A'}</p>

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

                            {!isHotel && (
                                <a
                                    href={`https://www.google.com/search?q=${encodeURIComponent(place.name + ' ' + (place.address || '') + ' reviews')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-block bg-orange-600 text-white text-xs px-2 py-1 rounded hover:bg-orange-700 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Google Reviews ↗
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
        </div >
    );

    // Memoize map points to prevent re-renders on typing
    const mapPlaces = useMemo(() => {
        if (waitingForConfirmation === 'food' || waitingForConfirmation === 'food_filters') {
            return restaurantResults;
        }
        if (waitingForConfirmation === 'hotels' || waitingForConfirmation === 'hotels_filters') {
            return hotelResults;
        }
        if (waitingForConfirmation === 'explore' || waitingForConfirmation === 'explore_filters') {
            return exploreResults;
        }
        return [];
    }, [waitingForConfirmation, restaurantResults, hotelResults, exploreResults]);

    const restoreFiltersFromMessage = (content: string) => {
        // 1. Extract Radius
        let radius = 8000;
        // Support both "within X miles" and "X mi radius" formats
        const radiusMatch = content.match(/within ([\d.]+) miles/) || content.match(/([\d.]+) mi radius/);
        if (radiusMatch) {
            radius = Math.round(parseFloat(radiusMatch[1]) * 1600);
        }

        // 2. Extract Location Preference
        let locationPreference: 'venue' | 'hotel' = 'venue';
        if (content.toLowerCase().includes('near hotel') || content.toLowerCase().includes('near the hotel')) {
            locationPreference = 'hotel';
        }

        // 3. Determine Type and Specific Filters
        // Use lowercase for robust matching
        const lowerContent = content.toLowerCase();

        if (lowerContent.includes('find me hotels') || lowerContent.includes('find me lodging') || lowerContent.includes('searching for hotels')) {
            setHotelFilters({ radius });
            setWaitingForConfirmation('hotels_filters');
        } else if (lowerContent.includes('restaurant') || lowerContent.includes('food')) {
            let cuisine = '';
            // Pattern: "Find me [Cuisine] near" or "Find me [Cuisine] restaurants near"
            // Note: The message generation logic is: `Find me ${cuisine} restaurants near...`
            // So if cuisine='Mexican', message='Find me Mexican restaurants near...'
            // We want to extract 'Mexican'.
            const match = content.match(/Find me (.+) near/i);
            if (match) {
                let captured = match[1].trim();
                // Strip "restaurants" or "food" if present to get raw cuisine
                cuisine = captured.replace(/restaurants|restaurant|food/gi, '').trim();
            }
            setFoodFilters({ locationPreference, radius, cuisine });
            setWaitingForConfirmation('food_filters');
        } else {
            // Explore
            let activity = '';
            const match = content.match(/Find me (.+) near/i);
            if (match) {
                activity = match[1].trim();
                if (activity.toLowerCase().includes('popular things to do')) {
                    activity = 'Popular';
                }
            }
            // Ensure we don't accidentally set "restaurants" as activity if regex missed above
            if (activity.toLowerCase().includes('restaurant')) return;

            setExploreFilters({ locationPreference, radius, activity });
            setWaitingForConfirmation('explore_filters');
        }
    };

    return (
        <div className="flex flex-col lg:flex-row w-full h-full bg-gray-50 overflow-hidden">
            {/* LEFT PANEL: Chat & Itinerary (Scrollable) */}
            <div className="w-full lg:w-1/2 h-full overflow-y-auto p-2 md:p-4 flex flex-col">
                <div className="w-full h-full flex flex-col">
                    {/* Chat Messages */}
                    <div className="space-y-4 mb-4 flex-grow">
                        {messages.length === 0 && (
                            <div className="text-center text-gray-500 py-8">
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">🎫 Event Trip Planner</h2>
                                <p>Tell me about an event or artist you want to see!</p>
                                <p className="text-sm mt-2">Example: "I want to see Taylor Swift" or "Find Lakers games"</p>
                            </div>
                        )}
                        {messages.map((m, index) => {
                            // Hide empty assistant messages (unless currently loading last message)
                            const isLast = index === messages.length - 1;
                            if (m.role === 'assistant' && !m.content.trim() && (!isLast || !isLoading)) return null;

                            return (
                                <div key={index} className={`p-4 rounded-lg ${m.role === 'user' ? 'bg-blue-100 ml-auto max-w-[90%]' : 'bg-white shadow mr-auto max-w-[90%]'}`}>
                                    <div className="font-semibold text-sm text-gray-600 mb-1">
                                        {m.role === 'user' ? '👤 You' : '🤖 AI Assistant'}
                                    </div>
                                    <p className="whitespace-pre-wrap">{m.content}</p>

                                    {/* Reset / Options Button for Search Prompts */}
                                    {m.role === 'user' && (m.content.startsWith('Find me') || m.content.startsWith('Searching for hotels')) && (
                                        <button
                                            onClick={() => restoreFiltersFromMessage(m.content)}
                                            className="mt-2 text-xs bg-white/50 hover:bg-white/80 text-blue-800 px-2 py-1 rounded transition-colors flex items-center gap-1 w-fit border border-blue-200"
                                            title="Restore these search options"
                                        >
                                            🔄 Search Options
                                        </button>
                                    )}
                                </div>
                            );
                        })}
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
                                🎭 Found {events.length} events - Select, then Double-click to Confirm:
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {events.map((event) => (
                                    <div
                                        key={event.id}
                                        onClick={() => handleEventSelect(event)}
                                        onDoubleClick={() => handleEventConfirm(event)}
                                        className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer border-2 overflow-hidden flex flex-col sm:flex-row ${highlightedEventId === event.id ? 'border-green-500 ring-2 ring-green-300 transform scale-[1.01]' : 'border-transparent hover:border-blue-500'
                                            }`}
                                    >
                                        {event.image && (
                                            <img src={event.image} alt={event.name} className="w-full sm:w-32 h-32 object-cover" />
                                        )}
                                        <div className="p-3 flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-800 truncate">{event.name}</h4>
                                            <p className="text-sm text-gray-600">📅 {formatDate(event.date)}</p>
                                            <p className="text-sm text-gray-600">📍 {event.venue}</p>
                                            <p className="text-sm text-gray-500 truncate">{event.city}, {event.state}</p>
                                            <p className="text-sm font-semibold text-green-600 mt-1">{event.priceRange}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isSearchingPlaces && (
                        <div className="text-center py-4 text-gray-500">
                            <div className="animate-pulse">🔍 Finding nearby places...</div>
                        </div>
                    )}

                    {/* ----- HOTELS SECTION (Show only when not in food or explore mode) ----- */}
                    {hotelResults.length > 0 && !['food', 'food_filters', 'explore', 'explore_filters'].includes(waitingForConfirmation) && (
                        <div className="mb-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                            <div className="bg-gray-50 p-3 flex justify-between items-center border-b border-gray-200">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                    🏨 Found {hotelResults.length} Hotels
                                </h3>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 font-medium">
                                        {hotelFilters.radius / 1600} mi radius
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50/50">
                                {/* Filter Controls */}
                                <div className="mb-3 flex justify-end">
                                    <div className="flex items-center gap-1 bg-white rounded border border-gray-300 p-1">
                                        <span className="text-xs font-bold text-gray-400 px-1">DIST:</span>
                                        {[8000, 16000, 32000].map((r) => (
                                            <button
                                                key={r}
                                                onClick={(e) => { e.stopPropagation(); setHotelFilters(prev => ({ ...prev, radius: r })); executeFilteredSearch(); }}
                                                className={`px-2 py-0.5 text-xs font-bold rounded ${hotelFilters.radius === r ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                            >
                                                {(r / 1600).toFixed(0)}m
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {hotelResults.map((place) => {
                                        if (!place) return null; // Safe check
                                        return (
                                            <div
                                                key={place.id}
                                                onClick={() => handlePlaceSelect(place)}
                                                onDoubleClick={() => handlePlaceConfirm(place)}
                                                className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer border-2 overflow-hidden flex flex-col sm:flex-row ${selectedPlace?.id === place.id ? 'border-green-500 ring-2 ring-green-300 transform scale-[1.01]' : 'border-transparent hover:border-green-500'}`}
                                            >
                                                {place.photo ? (
                                                    <img src={place.photo} alt={place.name} className="w-full sm:w-32 h-32 object-cover" />
                                                ) : (
                                                    <div className="w-full sm:w-32 h-32 bg-gray-200 flex items-center justify-center text-4xl">
                                                        🏨
                                                    </div>
                                                )}
                                                <div className="p-3 flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-800 truncate">{place.name}</h4>
                                                    <div className="flex items-center gap-2 text-sm flex-wrap mt-1">
                                                        {place.rating > 0 && (
                                                            <span className="text-yellow-500 font-semibold tracking-wide">
                                                                {'★'.repeat(Math.round(place.rating))}{'☆'.repeat(5 - Math.round(place.rating))}
                                                                <span className="text-gray-400 font-normal ml-1">({place.rating})</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-gray-600 truncate mt-1">📍 {place.address || 'Address N/A'}</p>

                                                    <a
                                                        href={`https://www.google.com/search?q=${encodeURIComponent(place.name + ' ' + (place.address || '') + ' reviews')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-2 inline-block bg-orange-600 text-white text-xs px-2 py-1 rounded hover:bg-orange-700 transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        Google Reviews ↗
                                                    </a>

                                                    <a
                                                        href={`https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(place.name + ' ' + (place.address || ''))}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-2 inline-block bg-blue-600 text-white text-xs px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        Book on Expedia ↗
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ----- RESTAURANTS SECTION (Show only when not in hotel or explore mode) ----- */}
                    {restaurantResults.length > 0 && !['hotels', 'hotels_filters', 'explore', 'explore_filters'].includes(waitingForConfirmation) && (
                        <div className="mb-6">
                            <div className="flex justify-between items-end mb-3">
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    🍽️ Nearby Restaurants
                                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                        {restaurantResults.length} found
                                    </span>
                                </h3>
                                <button
                                    onClick={() => setWaitingForConfirmation('food_filters')}
                                    className="text-xs text-orange-600 font-bold bg-orange-50 px-3 py-1.5 rounded border border-orange-200 hover:bg-orange-100 hover:border-orange-300 transition-colors flex items-center gap-1"
                                >
                                    🔧 Filters: {foodFilters.cuisine || 'All'} • {(foodFilters.radius / 1600).toFixed(1)} mi
                                </button>
                            </div>

                            {renderPlacesGrid(restaurantResults, false)}
                        </div>
                    )}

                    {/* ----- EXPLORE SECTION (Show only when in explore mode) ----- */}
                    {exploreResults.length > 0 && ['explore', 'explore_filters', null].includes(waitingForConfirmation) && (
                        <div className="mb-6">
                            <div className="flex justify-between items-end mb-3">
                                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    🎭 Explore Results
                                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                        {exploreResults.length} found
                                    </span>
                                </h3>
                                <button
                                    onClick={() => setWaitingForConfirmation('explore_filters')}
                                    className="text-xs text-purple-600 font-bold bg-purple-50 px-3 py-1.5 rounded border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-colors flex items-center gap-1"
                                >
                                    🔧 Filters: {exploreFilters.activity || 'All'} • {(exploreFilters.radius / 1600).toFixed(0)} mi
                                </button>
                            </div>

                            {renderPlacesGrid(exploreResults, false)}
                        </div>
                    )}

                    {/* NO RESULTS INDICATORS */}
                    {hasSearchedPlaces && !isSearchingPlaces && (
                        <>
                            {waitingForConfirmation === 'hotels_filters' && hotelResults.length === 0 && (
                                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                                    ❌ No hotels found with current filters.
                                </div>
                            )}
                            {waitingForConfirmation === 'food_filters' && restaurantResults.length === 0 && (
                                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                                    ❌ No restaurants found. Try changing filters.
                                </div>
                            )}
                            {waitingForConfirmation === 'explore_filters' && exploreResults.length === 0 && (
                                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                                    ❌ No places found. Try increasing radius.
                                </div>
                            )}
                        </>
                    )}

                    {/* Input Area (Sticky Bottom on Mobile) */}
                    <div className="sticky bottom-0 bg-white pt-2 pb-4 border-t border-gray-200 mt-auto">
                        {waitingForConfirmation === 'hotels' ? (
                            <div className="flex flex-col items-center justify-center py-2 animate-fadeIn bg-gray-50 rounded-lg border border-gray-200 p-4">
                                <p className="mb-3 font-semibold text-gray-700">Would you like to search for hotels nearby?</p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => confirmHotels(true)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full font-bold transition-all transform hover:scale-105"
                                    >
                                        🏨 Yes, Find Hotels
                                    </button>
                                    <button
                                        onClick={() => confirmHotels(false)}
                                        className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-full font-bold transition-all"
                                    >
                                        No, thanks
                                    </button>
                                </div>
                            </div>
                        ) : waitingForConfirmation === 'food' ? (
                            <div className="flex flex-col items-center justify-center py-2 animate-fadeIn bg-gray-50 rounded-lg border border-gray-200 p-4">
                                <p className="mb-3 font-semibold text-gray-700">Would you like to find restaurants nearby?</p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => confirmFood(true)}
                                        className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-full font-bold transition-all transform hover:scale-105"
                                    >
                                        🍽️ Yes, Find Food
                                    </button>
                                    <button
                                        onClick={() => confirmFood(false)}
                                        className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-full font-bold transition-all"
                                    >
                                        No, thanks
                                    </button>
                                </div>
                            </div>
                        ) : waitingForConfirmation === 'food_filters' ? (
                            <div className="bg-orange-50 p-4 rounded-lg animate-fadeIn border border-gray-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-700">🍽️ Food Preferences</h3>
                                    <button onClick={() => setWaitingForConfirmation(null)} className="text-gray-400 hover:text-gray-600">×</button>
                                </div>

                                <div className="space-y-4">
                                    {/* 1. Location Toggle */}
                                    <div className="flex bg-white rounded-lg border border-gray-300 p-1">
                                        <button
                                            onClick={() => setFoodFilters(prev => ({ ...prev, locationPreference: 'venue' }))}
                                            className={`flex-1 py-1 rounded-md text-sm font-bold transition-colors ${foodFilters.locationPreference === 'venue' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            📍 Near Venue
                                        </button>
                                        <button
                                            onClick={() => setFoodFilters(prev => ({ ...prev, locationPreference: 'hotel' }))}
                                            className={`flex-1 py-1 rounded-md text-sm font-bold transition-colors ${foodFilters.locationPreference === 'hotel' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                            disabled={!itinerary.some(i => 'types' in i && (i.types.includes('lodging') || i.types.includes('hotel')))}
                                        >
                                            🏨 Near Hotel
                                        </button>
                                    </div>

                                    {/* 2. Radius */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Search Distance</label>
                                        <div className="flex gap-2 mt-1">
                                            {[8000, 16000, 32000].map((r) => (
                                                <button
                                                    key={r}
                                                    onClick={() => setFoodFilters(prev => ({ ...prev, radius: r }))}
                                                    className={`px-3 py-1 rounded text-xs font-bold border ${foodFilters.radius === r ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                                >
                                                    {(r / 1600).toFixed(0)} mi
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 3. Cuisine */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Cuisine / Type</label>
                                        <div className="flex flex-wrap gap-2 mt-1 mb-2">
                                            {['Italian', 'Mexican', 'Burgers', 'Sushi', 'Pizza', 'Coffee'].map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setFoodFilters(prev => ({ ...prev, cuisine: c }))}
                                                    className={`px-2 py-1 rounded-full text-xs font-bold border ${foodFilters.cuisine === c ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}
                                                >
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 p-2 text-sm border border-gray-300 rounded focus:border-orange-500 focus:outline-none"
                                                placeholder="Or type (e.g., 'Vegan')..."
                                                value={foodFilters.cuisine}
                                                onChange={(e) => setFoodFilters(prev => ({ ...prev, cuisine: e.target.value }))}
                                                autoFocus
                                            />
                                            <button
                                                onClick={executeFoodSearch}
                                                disabled={!foodFilters.cuisine.trim()}
                                                className="bg-orange-600 text-white px-4 py-2 rounded font-bold hover:bg-orange-700 disabled:opacity-50"
                                            >
                                                Search
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : waitingForConfirmation === 'hotels_filters' ? (
                            <div className="bg-gray-50 p-4 rounded-lg animate-fadeIn border border-gray-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-gray-700">🏨 Hotel Preferences</h3>
                                    <button onClick={() => setWaitingForConfirmation(null)} className="text-gray-400 hover:text-gray-600">×</button>
                                </div>

                                <div className="space-y-4">
                                    {/* Distance Only */}
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

                                    <button
                                        onClick={executeFilteredSearch}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-md transform active:scale-95 transition-all mt-2"
                                    >
                                        🔍 Search Hotels
                                    </button>
                                </div>
                            </div>
                        ) : waitingForConfirmation === 'explore' ? (
                            <div className="flex flex-col items-center justify-center py-2 animate-fadeIn bg-purple-50 rounded-lg border border-purple-200 p-4">
                                <p className="mb-3 font-semibold text-gray-700">Would you like to explore nearby activities?</p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => confirmExplore(true)}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full font-bold transition-all transform hover:scale-105"
                                    >
                                        🎭 Yes, Explore
                                    </button>
                                    <button
                                        onClick={() => confirmExplore(false)}
                                        className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-full font-bold transition-all"
                                    >
                                        No, I'm done
                                    </button>
                                </div>
                            </div>
                        ) : waitingForConfirmation === 'explore_filters' ? (
                            <div className="bg-purple-50 p-4 rounded-lg animate-fadeIn border border-purple-200">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-700">🎭 Explore Activities</h3>
                                    <button onClick={() => setWaitingForConfirmation(null)} className="text-gray-400 hover:text-gray-600">×</button>
                                </div>

                                <div className="space-y-4">
                                    {/* 1. Location Toggle */}
                                    <div className="flex bg-white rounded-lg border border-gray-300 p-1">
                                        <button
                                            onClick={() => setExploreFilters(prev => ({ ...prev, locationPreference: 'venue' }))}
                                            className={`flex-1 py-1 rounded-md text-sm font-bold transition-colors ${exploreFilters.locationPreference === 'venue' ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            📍 Near Venue
                                        </button>
                                        <button
                                            onClick={() => setExploreFilters(prev => ({ ...prev, locationPreference: 'hotel' }))}
                                            className={`flex-1 py-1 rounded-md text-sm font-bold transition-colors ${exploreFilters.locationPreference === 'hotel' ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                            disabled={!itinerary.some(i => 'types' in i && (i.types.includes('lodging') || i.types.includes('hotel')))}
                                        >
                                            🏨 Near Hotel
                                        </button>
                                    </div>

                                    {/* 2. Radius */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Search Distance</label>
                                        <div className="flex gap-2 mt-1">
                                            {[8000, 16000, 32000].map((r) => (
                                                <button
                                                    key={r}
                                                    onClick={() => setExploreFilters(prev => ({ ...prev, radius: r }))}
                                                    className={`px-3 py-1 rounded text-xs font-bold border ${exploreFilters.radius === r ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                                >
                                                    {(r / 1600).toFixed(0)} mi
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 3. Activity Presets */}
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">What are you looking for?</label>
                                        <div className="flex flex-wrap gap-2 mt-1 mb-2">
                                            {/* Popular Option */}
                                            <button
                                                onClick={() => setExploreFilters(prev => ({ ...prev, activity: 'Popular' }))}
                                                className={`px-2 py-1 rounded-full text-xs font-bold border ${exploreFilters.activity === 'Popular' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'}`}
                                            >
                                                🔥 Most Popular
                                            </button>

                                            {['Movies', 'Hiking', 'Museums', 'Parks', 'Shopping', 'Nightlife', 'Spa'].map(a => (
                                                <button
                                                    key={a}
                                                    onClick={() => setExploreFilters(prev => ({ ...prev, activity: a }))}
                                                    className={`px-2 py-1 rounded-full text-xs font-bold border ${exploreFilters.activity === a ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
                                                >
                                                    {a}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 p-2 text-sm border border-gray-300 rounded focus:border-purple-500 focus:outline-none"
                                                placeholder="Or type (e.g., 'Bowling')..."
                                                value={exploreFilters.activity}
                                                onChange={(e) => setExploreFilters(prev => ({ ...prev, activity: e.target.value }))}
                                            />
                                            <button
                                                onClick={executeExploreSearch}
                                                disabled={!exploreFilters.activity.trim()}
                                                className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700 disabled:opacity-50"
                                            >
                                                Search
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {/* Quick Actions */}
                                {selectedEvent && (
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => setWaitingForConfirmation('food_filters')}
                                            className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200 hover:bg-orange-100 transition-colors flex items-center gap-1"
                                        >
                                            🍽️ Find Food
                                        </button>
                                        <button
                                            onClick={() => setWaitingForConfirmation('hotels_filters')}
                                            className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1"
                                        >
                                            🏨 Find Hotels
                                        </button>
                                        <button
                                            onClick={() => setWaitingForConfirmation('explore_filters')}
                                            className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-200 hover:bg-purple-100 transition-colors flex items-center gap-1"
                                        >
                                            🎭 Explore
                                        </button>

                                    </div>
                                )}
                                <form onSubmit={handleSubmit} className="flex gap-2">
                                    <input
                                        className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                        value={input}
                                        placeholder="Chat (e.g., 'Find hotels')..."
                                        onChange={(e) => setInput(e.target.value)}
                                        disabled={isLoading}
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading || !input.trim()}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm font-semibold"
                                    >
                                        {isLoading ? '...' : 'Send'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT PANEL: Map View + Itinerary (Desktop) */}
            <div className="hidden lg:flex lg:flex-col w-1/2 h-full bg-gray-200 border-l border-gray-300">
                {/* Map Section - Takes ~60% of height */}
                <div className="h-[60%] relative">
                    <MapView
                        events={events}
                        places={mapPlaces}
                        selectedEvent={selectedEvent}
                        selectedPlace={selectedPlace}
                        itinerary={itinerary}
                        onSelectPlace={handlePlaceSelect}
                    />
                </div>

                {/* Itinerary Section - Below the map */}
                <div className="h-[40%] overflow-y-auto bg-white border-t border-gray-300">
                    {(itinerary.length > 0 || selectedEvent) ? (
                        <div className="p-4 bg-purple-50 h-full">
                            <div className="sticky top-0 bg-purple-50 py-2 flex justify-between items-center mb-3">
                                <h3 className="font-bold text-purple-800">📋 Your Itinerary</h3>
                                <button
                                    onClick={handleItinerarySubmission}
                                    className="text-xs font-bold text-white bg-purple-600 px-3 py-1.5 rounded-full hover:bg-purple-700 shadow-sm transition-all flex items-center gap-1 active:scale-95"
                                >
                                    ✨ Generate Schedule
                                </button>
                            </div>
                            <div className="space-y-2">
                                {selectedEvent && (
                                    <div className="flex items-center gap-2 p-2 bg-white rounded border">
                                        <span className="text-lg">🎫</span>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm">{selectedEvent.name}</p>
                                            <p className="text-xs text-gray-500">{selectedEvent.venue}</p>
                                        </div>
                                    </div>
                                )}
                                {itinerary.map((item, idx) => {
                                    const isRestaurant = 'types' in item && !item.types.includes('lodging');
                                    const isHotel = 'types' in item && (item.types.includes('lodging') || item.types.includes('hotel'));
                                    return (
                                        <div key={idx} className="flex items-center gap-2 p-2 rounded border bg-white">
                                            <span className="text-lg">
                                                {getPlaceEmoji(item.types)}
                                            </span>
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm">{item.name}</p>
                                                <p className="text-xs text-gray-500">
                                                    {'rating' in item && `⭐ ${(item as Place).rating}`}
                                                </p>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {isHotel && (
                                                        <>
                                                            <a
                                                                href={`https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(item.name + ' ' + (item.address || ''))}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-block bg-blue-600 text-white text-[10px] px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                Book on Expedia ↗
                                                            </a>
                                                            <a
                                                                href={`https://www.google.com/search?q=${encodeURIComponent(item.name + ' ' + (item.address || '') + ' reviews')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-block bg-orange-600 text-white text-[10px] px-2 py-1 rounded hover:bg-orange-700 transition-colors"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                Google Reviews ↗
                                                            </a>
                                                        </>
                                                    )}
                                                    {isRestaurant && (
                                                        <a
                                                            href={`https://www.google.com/search?q=${encodeURIComponent(item.name + ' ' + (item.address || '') + ' reviews')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-block bg-orange-600 text-white text-[10px] px-2 py-1 rounded hover:bg-orange-700 transition-colors"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            Google Reviews ↗
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeFromItinerary(item.id)}
                                                className="text-gray-400 hover:text-red-500 p-1"
                                                title="Remove from itinerary"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <p className="text-2xl mb-2">📋</p>
                                <p className="text-sm">Your itinerary will appear here</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile View Toggle (Optional - For now map is hidden on mobile or stacked if we change hidden lg:block) */}
        </div>
    );
    // Assuming this is a functional component, the extra braces are removed.
    // If it's a class component, the structure would be different.
    // Based on the context (useState, etc.), it's a functional component.
}
