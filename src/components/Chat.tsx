'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSession } from "next-auth/react"
import { getChat, saveChat } from "@/app/actions"
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



interface ChatProps {
    sessionId: string;
    isSidebarOpen: boolean;
    isDarkMode: boolean;
    openScheduleTrigger?: number;
}

export default function Chat({ sessionId, isSidebarOpen, isDarkMode, openScheduleTrigger }: ChatProps) {
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

    // Itinerary state - moved here to be available in save functions
    const [itinerary, setItinerary] = useState<Array<Event | Place>>([]);
    const [schedule, setSchedule] = useState<Array<{ time: string, activity: string, description: string }>>([]);
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);

    // Track if this chat has been confirmed with an event name
    const [chatTitle, setChatTitle] = useState<string | null>(null);
    // Track if initial load is complete to prevent overwriting DB with empty state
    const [isLoaded, setIsLoaded] = useState(false);
    // Track if user has modified state to preventing saving on load
    const isDirtyRef = useRef(false);


    // --- Effect: Open Schedule from Sidebar Trigger ---
    useEffect(() => {
        if (openScheduleTrigger && openScheduleTrigger > 0) {
            setIsScheduleOpen(true);
        }
    }, [openScheduleTrigger]);

    // --- Session Management ---
    const { data: session, status } = useSession();

    useEffect(() => {
        // Load messages for this session
        const load = async () => {
            if (session?.user) {
                const dbChat = await getChat(sessionId);
                if (dbChat) {
                    console.log('Loading chat from DB:', dbChat);

                    // Restore Context
                    if (dbChat.events) setEvents(dbChat.events);
                    if (dbChat.itinerary) setItinerary(dbChat.itinerary);
                    if (dbChat.schedule) setSchedule(dbChat.schedule);
                    if (dbChat.selectedEvent) setSelectedEvent(dbChat.selectedEvent);
                    if (dbChat.title) setChatTitle(dbChat.title);

                    // Generate Welcome Back Message based on context
                    if (dbChat.title) {
                        setMessages([{
                            role: 'assistant',
                            content: `Welcome back! I've loaded your itinerary for **${dbChat.title}**. You can add more hotels, find food, or generate your schedule.`
                        }]);
                    } else {
                        // Should not happen for confirmed chats, but fallback
                        setMessages([]);
                    }
                    setIsLoaded(true);
                } else {
                    // DB chat not found - treat as new
                    resetState();
                    setIsLoaded(true); // Ready to save new stuff
                }
            } else {
                // LocalStorage Fallback
                const savedData = localStorage.getItem(`chat_session_${sessionId}`);
                if (savedData) {
                    try {
                        const parsed = JSON.parse(savedData);
                        if (parsed.events) setEvents(parsed.events);
                        if (parsed.itinerary) setItinerary(parsed.itinerary);
                        if (parsed.schedule) setSchedule(parsed.schedule);
                        if (parsed.selectedEvent) setSelectedEvent(parsed.selectedEvent);
                        if (parsed.preview) setChatTitle(parsed.preview);

                        // If it has a title, it's a confirmed chat. Generate fresh context if needed/wanted.
                        // For local storage, user might want history?
                        // Current logic: persist history in localStorage?
                        // The 'saveSessionLocal' saves 'messages'.
                        // Let's load them if they exist for continuity in guest mode
                        if (parsed.messages && parsed.messages.length > 0) {
                            setMessages(parsed.messages);
                        } else if (parsed.preview) {
                            setMessages([{
                                role: 'assistant',
                                content: `Welcome back! I've loaded your itinerary for **${parsed.preview}**.`
                            }]);
                        }
                    } catch (e) {
                        console.error('Failed to parse local session', e);
                    }
                } else {
                    resetState();
                }
                setIsLoaded(true);
            }
        };

        if (status !== 'loading') {
            load();
        }

    }, [sessionId, session, status]); // Reload if session changes (login)



    const resetState = () => {
        setMessages([]);
        setEvents([]);
        setItinerary([]);
        setSchedule([]);
        setHotelResults([]);
        setRestaurantResults([]);
        setExploreResults([]);
        setSelectedEvent(null);
        setSelectedPlace(null);
        setWaitingForConfirmation(null);
        setHasSearchedEvents(false);
        setHasSearchedPlaces(false);
        setIsHotelsExpanded(true);
        setInput('');
        setChatTitle(null);
    }

    const saveSessionData = async (msgs: Array<{ role: string, content: string }>, eventName?: string) => {
        // Use provided eventName or existing chatTitle
        const titleToUse = eventName || chatTitle;

        // ONLY save if we have a title (event was confirmed)
        if (!titleToUse) return;

        // Update chatTitle state if a new event name is provided
        if (eventName && eventName !== chatTitle) {
            setChatTitle(eventName);
        }

        console.log('Saving chat:', { sessionId, titleToUse, messageCount: msgs.length, msgs });

        // User requested NOT to save conversation history, only context.
        // We pass empty array for messages to saveChat/saveSessionLocal so history is not persisted causing a "fresh" start on reload.
        const messagesToSave: any[] = [];

        // DB Save
        if (session?.user) {
            const metaData = {
                events,
                itinerary,
                schedule,
                selectedEvent
            };
            const result = await saveChat(sessionId, titleToUse, messagesToSave, metaData);
            console.log('DB save result:', result);
        } else {
            // LocalStorage Save
            saveSessionLocal(messagesToSave, titleToUse);
        }

        // Trigger sidebar refresh
        window.dispatchEvent(new Event('storage'));
    };

    const saveSessionLocal = (msgs: Array<{ role: string, content: string }>, eventName: string) => {
        // ONLY save if we have an event name
        if (!eventName) return;

        const existingDataStr = localStorage.getItem(`chat_session_${sessionId}`);
        let existingData = existingDataStr ? JSON.parse(existingDataStr) : {};

        // Preserve Pinned State if exists
        const isPinned = existingData.isPinned || false;

        const data = {
            id: sessionId,
            messages: msgs,
            events,
            itinerary,
            schedule,
            selectedEvent,
            preview: eventName,
            isPinned: isPinned,
            timestamp: Date.now()
        };

        localStorage.setItem(`chat_session_${sessionId}`, JSON.stringify(data));
    };

    // Auto-save messages ONLY if chat is confirmed (has a title) AND fully loaded AND user has interacted (dirty)
    useEffect(() => {
        if (isLoaded && chatTitle && messages.length > 0 && isDirtyRef.current) {
            saveSessionData(messages);
        }
    }, [messages, chatTitle, itinerary, schedule, selectedEvent, isLoaded]);

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
        isDirtyRef.current = true;
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
        isDirtyRef.current = true;
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

        // Set chat title to event name - this triggers the auto-save useEffect
        // once state updates are processed (including selectedEvent)
        setChatTitle(event.name);

        sendToAI(newMessages);
    };

    const handlePlaceSelect = (place: Place) => {
        setSelectedPlace(place);
    };

    const handlePlaceConfirm = (place: Place) => {
        // Add to itinerary
        isDirtyRef.current = true;
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
            handleQuickReply("No thanks. (If you change your mind, click 'Find Food' or type 'find food'.)");
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
            handleQuickReply("No thanks. (If you change your mind, click 'Explore' or type 'explore'.)");
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
        isDirtyRef.current = true;
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
- Be conversational in your main response, but DO NOT list the full schedule in the text. Instead, say "I've generated your schedule, click 'View Schedule' to see it."
- IMPORTANT: Use AM/PM format (e.g., "7:00 PM") for all times, NOT military time.
- IMPORTANT: At the very end of your response, strictly output the schedule as a JSON array inside a \`\`\`json block.
- Format:
\`\`\`json
[
  { "time": "hh:mm start - hh:mm end", "activity": "Title", "description": "Short description" }
]
\`\`\`
Goal: A complete, optimized itinerary plan.
        `;

        // Show simple message to user
        const simpleUserMessage = { role: 'user', content: "Can you generate a schedule for me?" };
        setMessages(prev => [...prev, simpleUserMessage]);

        // Send FULL prompt to AI (but keep simple message in UI history)
        // We temporarily append the complex prompt to the message history sent to AI, 
        // but don't add it to the 'messages' state that is rendered.
        // Actually, to make 'sendToAI' work with the current 'messages' state, we need to handle this carefully.
        // The sendToAI function takes 'messagesToSend'. We can construct that manually.

        const complexMessage = { role: 'user', content: prompt };
        sendToAI([...messages, complexMessage]);
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

                // Extract JSON schedule if present
                const jsonMatch = fullResponse.match(/```json\s*(\[\s*\{[\s\S]*\}\s*\])\s*```/);
                if (jsonMatch) {
                    try {
                        const jsonContent = jsonMatch[1];
                        const parsedSchedule = JSON.parse(jsonContent);
                        if (Array.isArray(parsedSchedule)) {
                            setSchedule(parsedSchedule);
                            isDirtyRef.current = true;
                            // Remove the JSON block from the displayed message
                            assistantMessage.content = cleanDisplayText(fullResponse.replace(jsonMatch[0], '').trim());
                        }
                    } catch (e) {
                        console.error('Failed to parse AI schedule JSON', e);
                        assistantMessage.content = cleanDisplayText(fullResponse);
                    }
                } else {
                    assistantMessage.content = cleanDisplayText(fullResponse);
                }

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

        isDirtyRef.current = true;
        const userMessage = { role: 'user', content: input };
        const newMessages = [...messages, userMessage];

        setMessages(newMessages);
        setInput('');

        // --- Automate Filter Triggers based on user input ---
        const lowerInput = input.toLowerCase();

        // 1. Explore Automation
        if (lowerInput.includes('explore') || (lowerInput.includes('find') && (lowerInput.includes('activity') || lowerInput.includes('things to do')))) {
            setWaitingForConfirmation('explore_filters');
            setExploreFilters(prev => ({ ...prev, locationPreference: 'venue', radius: 8000, activity: '' }));
        }
        // 2. Hotels Automation
        else if (lowerInput.includes('find') && (lowerInput.includes('hotel') || lowerInput.includes('lodging'))) {
            setWaitingForConfirmation('hotels_filters');
            setIsHotelsExpanded(true);
        }
        // 3. Food Automation
        else if (lowerInput.includes('find') && (lowerInput.includes('food') || lowerInput.includes('restaurant'))) {
            setWaitingForConfirmation('food_filters');
            setFoodFilters(prev => ({ ...prev, locationPreference: 'venue', radius: 1600, cuisine: '' }));
        }

        sendToAI(newMessages);
    };

    const confirmHotels = (confirmed: boolean) => {
        if (confirmed) {
            setWaitingForConfirmation('hotels_filters');
            // handleQuickReply("Yes, please find hotels."); // Optional: verify filters
        } else {
            setWaitingForConfirmation(null);
            handleQuickReply("No thanks. (If you change your mind, just click 'Find Hotels' or type 'find hotels'.)");
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
                        className={`bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer border-2 overflow-hidden flex flex-col sm:flex-row ${selectedPlace?.id === place.id ? 'border-green-500 ring-2 ring-green-300 transform scale-[1.01]' : 'border-transparent dark:border-gray-700 hover:border-green-500'
                            }`}
                    >
                        <PlaceImage place={place} />
                        <div className="p-3 flex-1 min-w-0">
                            <h4 className="font-bold text-gray-800 dark:text-gray-100 truncate">{place.name}</h4>
                            <div className="flex items-center gap-2 text-sm flex-wrap mt-1">
                                {place.rating > 0 && (
                                    <span className="text-yellow-500 font-semibold tracking-wide">
                                        {'★'.repeat(Math.round(place.rating))}{'☆'.repeat(5 - Math.round(place.rating))}
                                        <span className="text-gray-400 font-normal ml-1">({place.rating})</span>
                                        {place.userRatingsTotal > 0 && (
                                            <span className="text-gray-400 font-normal ml-1">• {place.userRatingsTotal} reviews</span>
                                        )}
                                    </span>
                                )}
                            </div>

                            <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1">📍 {place.address || 'Address N/A'}</p>

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
        <div className="flex flex-col lg:flex-row w-full h-full bg-gray-50 dark:bg-gray-950 overflow-hidden text-gray-800 dark:text-gray-100">
            {/* LEFT PANEL: Chat & Itinerary (Scrollable) */}
            <div className={`w-full lg:w-1/2 h-full overflow-y-auto p-2 md:p-4 flex flex-col transition-opacity duration-300 ease-in-out ${isSidebarOpen ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                <div className="w-full h-full flex flex-col">
                    {/* Chat Messages */}
                    <div className="space-y-4 mb-4 flex-grow">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 py-8">
                                <div className="mb-4 animate-bounce-slow">
                                    {/* Simple Gopher Icon */}
                                    <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        {/* Head/Body */}
                                        <rect x="25" y="30" width="50" height="70" rx="25" fill="#10B981" />
                                        {/* Ears */}
                                        <circle cx="25" cy="40" r="10" fill="#10B981" />
                                        <circle cx="25" cy="40" r="5" fill="#A7F3D0" />
                                        <circle cx="75" cy="40" r="10" fill="#10B981" />
                                        <circle cx="75" cy="40" r="5" fill="#A7F3D0" />
                                        {/* Face Details */}
                                        <circle cx="40" cy="55" r="4" fill="#064E3B" />
                                        <circle cx="60" cy="55" r="4" fill="#064E3B" />
                                        <ellipse cx="50" cy="65" rx="8" ry="5" fill="#047857" />
                                        <rect x="46" y="68" width="8" height="6" rx="1" fill="white" />
                                    </svg>
                                </div>
                                <p className="text-lg font-medium text-gray-700 dark:text-gray-200">Tell me about an event or artist you want to see!</p>
                                <p className="text-sm mt-2">Example: "I want to see Taylor Swift" or "Find Lakers games"</p>
                            </div>
                        )}
                        {messages.map((m, index) => {
                            // Hide empty assistant messages (unless currently loading last message)
                            const isLast = index === messages.length - 1;
                            if (m.role === 'assistant' && !m.content.trim() && (!isLast || !isLoading)) return null;

                            return (
                                <div key={index} className={`p-4 rounded-lg ${m.role === 'user' ? 'bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-100 ml-auto max-w-[90%]' : 'bg-white dark:bg-gray-800 shadow mr-auto max-w-[90%]'}`}>
                                    <div className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">
                                        {m.role === 'user' ? '👤 You' : '🤖 AI Assistant'}
                                    </div>
                                    <p className="whitespace-pre-wrap">{m.content}</p>

                                    {/* Reset / Options Button for Search Prompts */}
                                    {m.role === 'user' && (m.content.startsWith('Find me') || m.content.startsWith('Searching for hotels')) && (
                                        <button
                                            onClick={() => restoreFiltersFromMessage(m.content)}
                                            className="mt-2 text-xs bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/40 text-blue-800 dark:text-blue-300 px-2 py-1 rounded transition-colors flex items-center gap-1 w-fit border border-blue-200 dark:border-blue-800"
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
                        <div className="text-center py-4 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 mb-4 animate-fadeIn">
                            <p className="dark:text-red-400">❌ No events found matching your request.</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Try a different artist name or city.</p>
                        </div>
                    )}

                    {events.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-200">
                                🎭 Found {events.length} events - Select, then Double-click to Confirm:
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {events.map((event) => (
                                    <div
                                        key={event.id}
                                        onClick={() => handleEventSelect(event)}
                                        onDoubleClick={() => handleEventConfirm(event)}
                                        className={`bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer border-2 overflow-hidden flex flex-col sm:flex-row ${highlightedEventId === event.id ? 'border-green-500 ring-2 ring-green-300 transform scale-[1.01]' : 'border-transparent dark:border-gray-700 hover:border-blue-500'
                                            }`}
                                    >
                                        {event.image && (
                                            <img src={event.image} alt={event.name} className="w-full sm:w-32 h-32 object-cover" />
                                        )}
                                        <div className="p-3 flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-800 dark:text-gray-100 truncate">{event.name}</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">📅 {formatDate(event.date)}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">📍 {event.venue}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{event.city}, {event.state}</p>
                                            <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-1">{event.priceRange}</p>
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
                        <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="bg-gray-50 dark:bg-gray-800 p-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                    🏨 Found {hotelResults.length} Hotels
                                </h3>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500 font-medium">
                                        {hotelFilters.radius / 1600} mi radius
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                {/* Filter Controls */}
                                <div className="mb-3 flex justify-end">
                                    <div className="flex items-center gap-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 p-1">
                                        <span className="text-xs font-bold text-gray-400 px-1">DIST:</span>
                                        {[8000, 16000, 32000].map((r) => (
                                            <button
                                                key={r}
                                                onClick={(e) => { e.stopPropagation(); setHotelFilters(prev => ({ ...prev, radius: r })); executeFilteredSearch(); }}
                                                className={`px-2 py-0.5 text-xs font-bold rounded ${hotelFilters.radius === r ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}
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
                                                className={`bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all cursor-pointer border-2 overflow-hidden flex flex-col sm:flex-row ${selectedPlace?.id === place.id ? 'border-green-500 ring-2 ring-green-300 transform scale-[1.01]' : 'border-transparent dark:border-gray-700 hover:border-green-500'}`}
                                            >
                                                {place.photo ? (
                                                    <img src={place.photo} alt={place.name} className="w-full sm:w-32 h-32 object-cover" />
                                                ) : (
                                                    <div className="w-full sm:w-32 h-32 bg-gray-200 flex items-center justify-center text-4xl">
                                                        🏨
                                                    </div>
                                                )}
                                                <div className="p-3 flex-1 min-w-0">
                                                    <h4 className="font-bold text-gray-800 dark:text-gray-100 truncate">{place.name}</h4>
                                                    <div className="flex items-center gap-2 text-sm flex-wrap mt-1">
                                                        {place.rating > 0 && (
                                                            <span className="text-yellow-500 font-semibold tracking-wide">
                                                                {'★'.repeat(Math.round(place.rating))}{'☆'.repeat(5 - Math.round(place.rating))}
                                                                <span className="text-gray-400 font-normal ml-1">({place.rating})</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-1">📍 {place.address || 'Address N/A'}</p>

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
                        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="bg-gray-50 dark:bg-gray-800 p-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    🍽️ Nearby Restaurants
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                        {restaurantResults.length} found
                                    </span>
                                    <button
                                        onClick={() => setWaitingForConfirmation('food_filters')}
                                        className="text-xs text-orange-600 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-900/30 px-3 py-1.5 rounded border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:border-orange-300 dark:hover:border-orange-700 transition-colors flex items-center gap-1"
                                    >
                                        🔧 Filters: {foodFilters.cuisine || 'All'}
                                    </button>
                                </div>
                            </div>

                            <div className="p-4">
                                {renderPlacesGrid(restaurantResults, false)}
                            </div>
                        </div>
                    )}

                    {/* ----- EXPLORE SECTION (Show only when in explore mode) ----- */}
                    {exploreResults.length > 0 && ['explore', 'explore_filters', null].includes(waitingForConfirmation) && (
                        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="bg-gray-50 dark:bg-gray-800 p-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                    🎭 Explore Results
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                        {exploreResults.length} found
                                    </span>
                                    <button
                                        onClick={() => setWaitingForConfirmation('explore_filters')}
                                        className="text-xs text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 rounded border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 hover:border-purple-300 dark:hover:border-purple-700 transition-colors flex items-center gap-1"
                                    >
                                        🔧 Filters: {exploreFilters.activity || 'All'}
                                    </button>
                                </div>
                            </div>

                            <div className="p-4">
                                {renderPlacesGrid(exploreResults, false)}
                            </div>
                        </div>
                    )}

                    {/* NO RESULTS INDICATORS */}
                    {hasSearchedPlaces && !isSearchingPlaces && (
                        <>
                            {waitingForConfirmation === 'hotels_filters' && hotelResults.length === 0 && (
                                <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
                                    ❌ No hotels found with current filters.
                                </div>
                            )}
                            {waitingForConfirmation === 'food_filters' && restaurantResults.length === 0 && (
                                <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
                                    ❌ No restaurants found. Try changing filters.
                                </div>
                            )}
                            {waitingForConfirmation === 'explore_filters' && exploreResults.length === 0 && (
                                <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
                                    ❌ No places found. Try increasing radius.
                                </div>
                            )}
                        </>
                    )}

                    {/* Input Area */}
                    <div className="sticky bottom-0 pt-2 pb-4 mt-auto bg-transparent">
                        {waitingForConfirmation === 'hotels' ? (
                            <div className="flex flex-col items-center justify-center py-2 animate-fadeIn bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors">
                                <p className="mb-3 font-semibold text-gray-700 dark:text-gray-200">Would you like to search for hotels nearby?</p>
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
                            <div className="flex flex-col items-center justify-center py-2 animate-fadeIn bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors">
                                <p className="mb-3 font-semibold text-gray-700 dark:text-gray-200">Would you like to find restaurants nearby?</p>
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
                            <div className="bg-orange-50 dark:bg-gray-800 p-4 rounded-lg animate-fadeIn border border-gray-200 dark:border-gray-700 transition-colors">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-700 dark:text-gray-200">🍽️ Food Preferences</h3>
                                    <button onClick={() => setWaitingForConfirmation(null)} className="text-gray-400 hover:text-gray-600">×</button>
                                </div>

                                <div className="space-y-4">
                                    {/* 1. Location Toggle */}
                                    <div className="flex bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 p-1">
                                        <button
                                            onClick={() => setFoodFilters(prev => ({ ...prev, locationPreference: 'venue' }))}
                                            className={`flex-1 py-1 rounded-md text-sm font-bold transition-colors ${foodFilters.locationPreference === 'venue' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            📍 Near Venue
                                        </button>
                                        <button
                                            onClick={() => setFoodFilters(prev => ({ ...prev, locationPreference: 'hotel' }))}
                                            className={`flex-1 py-1 rounded-md text-sm font-bold transition-colors ${foodFilters.locationPreference === 'hotel' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
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
                                                    className={`px-3 py-1 rounded text-xs font-bold border ${foodFilters.radius === r ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
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
                                                    className={`px-2 py-1 rounded-full text-xs font-bold border ${foodFilters.cuisine === c ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-orange-300'}`}
                                                >
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:border-orange-500 focus:outline-none"
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
                            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg animate-fadeIn border border-gray-200 dark:border-gray-700 transition-colors">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-gray-700 dark:text-gray-200">🏨 Hotel Preferences</h3>
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
                                                    className={`flex-1 py-1 rounded text-sm font-bold border ${hotelFilters.radius === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
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
                            <div className="flex flex-col items-center justify-center py-2 animate-fadeIn bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4 transition-colors">
                                <p className="mb-3 font-semibold text-gray-700 dark:text-gray-200">Would you like to explore nearby activities?</p>
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
                            <div className="bg-purple-50 dark:bg-gray-800 p-4 rounded-lg animate-fadeIn border border-purple-200 dark:border-gray-700 transition-colors">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-gray-700 dark:text-gray-200">🎭 Explore Activities</h3>
                                    <button onClick={() => setWaitingForConfirmation(null)} className="text-gray-400 hover:text-gray-600">×</button>
                                </div>

                                <div className="space-y-4">
                                    {/* 1. Location Toggle */}
                                    <div className="flex bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 p-1">
                                        <button
                                            onClick={() => setExploreFilters(prev => ({ ...prev, locationPreference: 'venue' }))}
                                            className={`flex-1 py-1 rounded-md text-sm font-bold transition-colors ${exploreFilters.locationPreference === 'venue' ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
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
                                                    className={`px-3 py-1 rounded text-xs font-bold border ${exploreFilters.radius === r ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
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
                                                className={`px-2 py-1 rounded-full text-xs font-bold border ${exploreFilters.activity === 'Popular' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-red-300'}`}
                                            >
                                                🔥 Most Popular
                                            </button>

                                            {['Movies', 'Hiking', 'Museums', 'Parks', 'Shopping', 'Nightlife', 'Spa'].map(a => (
                                                <button
                                                    key={a}
                                                    onClick={() => setExploreFilters(prev => ({ ...prev, activity: a }))}
                                                    className={`px-2 py-1 rounded-full text-xs font-bold border ${exploreFilters.activity === a ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-purple-300'}`}
                                                >
                                                    {a}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:border-purple-500 focus:outline-none"
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
                                            className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-3 py-1 rounded-full border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors flex items-center gap-1"
                                        >
                                            🍽️ Find Food
                                        </button>
                                        <button
                                            onClick={() => setWaitingForConfirmation('hotels_filters')}
                                            className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1"
                                        >
                                            🏨 Find Hotels
                                        </button>
                                        <button
                                            onClick={() => setWaitingForConfirmation('explore_filters')}
                                            className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-1"
                                        >
                                            🎭 Explore
                                        </button>

                                    </div>
                                )}
                                <form onSubmit={handleSubmit} className="flex gap-2">
                                    <input
                                        className="flex-1 p-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm placeholder-gray-500 dark:placeholder-gray-400"
                                        value={input}
                                        placeholder="Type here..."
                                        onChange={(e) => setInput(e.target.value)}
                                        disabled={isLoading}
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading || !input.trim()}
                                        className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-colors shadow-sm font-semibold"
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
            <div className={`hidden lg:flex lg:flex-col w-1/2 h-full bg-gray-200 dark:bg-gray-800 border-l border-gray-300 dark:border-gray-700 transition-opacity duration-300 ease-in-out ${isSidebarOpen ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                {/* Map Section - Takes ~60% of height */}
                <div className="h-[60%] relative">
                    <MapView
                        events={events}
                        places={mapPlaces}
                        selectedEvent={selectedEvent}
                        selectedPlace={selectedPlace}
                        itinerary={itinerary}
                        onSelectPlace={handlePlaceSelect}
                        isDarkMode={isDarkMode}
                    />
                </div>

                {/* Itinerary Section - Below the map */}
                <div className="h-[40%] overflow-y-auto bg-emerald-50 dark:bg-emerald-950 border-t border-gray-300 dark:border-gray-700">
                    {(itinerary.length > 0 || selectedEvent) ? (
                        <div className="p-4 min-h-full">
                            <div className="sticky top-0 bg-emerald-50 dark:bg-emerald-950 py-2 flex justify-between items-center mb-3 z-20">
                                <h3 className="font-bold text-emerald-800 dark:text-emerald-200">📋 Your Itinerary</h3>
                                <button
                                    onClick={handleItinerarySubmission}
                                    className="text-xs font-bold text-white bg-emerald-600 px-3 py-1.5 rounded-full hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1 active:scale-95"
                                >
                                    ✨ Generate Schedule
                                </button>
                                {schedule.length > 0 && (
                                    <button
                                        onClick={() => setIsScheduleOpen(true)}
                                        className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-full hover:bg-emerald-200 shadow-sm transition-all flex items-center gap-1 active:scale-95 ml-2"
                                    >
                                        👁️ View Schedule
                                    </button>
                                )}
                            </div>

                            {/* Schedule Popup Modal */}
                            {isScheduleOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
                                        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                                🗓️ Trip Schedule
                                            </h3>
                                            <button
                                                onClick={() => setIsScheduleOpen(false)}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <div className="p-6 overflow-y-auto space-y-6">
                                            {schedule.map((item, i) => (
                                                <div key={i} className="flex gap-4 relative">
                                                    {/* Timeline Line */}
                                                    {i !== schedule.length - 1 && (
                                                        <div className="absolute left-[85px] top-8 bottom-[-24px] w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                                                    )}

                                                    <div className="w-[85px] flex-shrink-0 text-right">
                                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block pt-1">
                                                            {item.time.split('-')[0].trim()}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {item.time.split('-')[1]?.trim() || ''}
                                                        </span>
                                                    </div>

                                                    <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
                                                        <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-1">{item.activity}</h4>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.description}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-center">
                                            <button
                                                onClick={() => {
                                                    setIsScheduleOpen(false);
                                                    handleItinerarySubmission();
                                                }}
                                                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-2 mx-auto"
                                            >
                                                ↻ Regenerate Schedule
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                {selectedEvent && (
                                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                        <span className="text-lg">🎫</span>
                                        <div className="flex-1">
                                            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{selectedEvent.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{selectedEvent.venue}</p>
                                        </div>
                                    </div>
                                )}
                                {itinerary.map((item, idx) => {
                                    const isRestaurant = 'types' in item && !item.types.includes('lodging');
                                    const isHotel = 'types' in item && (item.types.includes('lodging') || item.types.includes('hotel'));
                                    const itemAsPlace = item as Place;
                                    return (
                                        <div key={idx} className="flex items-center gap-2 p-2 rounded border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                            <span className="text-lg">
                                                {getPlaceEmoji(item.types)}
                                            </span>
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{item.name}</p>
                                                {'rating' in item && itemAsPlace.rating > 0 && (
                                                    <p className="text-xs text-yellow-500">
                                                        {'★'.repeat(Math.round(itemAsPlace.rating))}{'☆'.repeat(5 - Math.round(itemAsPlace.rating))}
                                                        <span className="text-gray-400 ml-1">({itemAsPlace.rating})</span>
                                                    </p>
                                                )}
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

            {/* Mobile View Toggle (Optional) */}
        </div>
    );
    // Assuming this is a functional component, the extra braces are removed.
    // If it's a class component, the structure would be different.
    // Based on the context (useState, etc.), it's a functional component.
}
