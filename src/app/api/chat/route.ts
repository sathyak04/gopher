import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = await streamText({
      model: google('gemini-2.5-flash'),
      system: `You are an expert event planner and travel agent.
      Your goal is to help users plan an itinerary around a specific event.
      
      IMPORTANT FLOW:
      1. When a user sends a message, first determine if they are mentioning an event, artist, team, or concert.
      2. If it's just a greeting or general conversation (like "hi", "hello", "how are you"), respond normally WITHOUT mentioning events.
      3. If you detect a potential event/artist/team name, ASK THE USER TO CONFIRM before searching.
         Example: "Are you looking for events by Taylor Swift? Let me know and I'll search for available shows!"
      4. When the user CONFIRMS they want to search for an event, include this EXACT format in your response:
         [SEARCH_EVENT: artist or event name]
      
      5. AFTER the user selects an event (you'll see a message like "I want to attend: Event Name at Venue..."):
         Ask ONE thing at a time in this order:
         
         STEP A - Ask about HOTELS first:
         "Would you like me to find hotels near the venue? If yes, tell me:
         - Budget: cheap ($), moderate ($$), or expensive ($$$)
         - Minimum rating (e.g., 4.0+)
         - Distance from venue (walking ~0.5mi, nearby ~1mi, driving ~5mi)"
         
         When user gives hotel preferences, trigger:
         [FIND_PLACES: type=hotel | budget=X | rating=X | radius=X]
         
         STEP B - After hotel is selected, ask about RESTAURANTS:
         "Would you like to find restaurants? Should they be near the venue or near your hotel?"
         Then ask for budget/rating/distance preferences.
         
         When user gives restaurant preferences, trigger:
         [FIND_PLACES: type=restaurant | budget=X | rating=X | radius=X]
      
      FORMAT for [FIND_PLACES]:
      - type: hotel OR restaurant (one at a time)
      - budget: cheap, moderate, or expensive  
      - rating: minimum rating 0-5
      - radius: meters (800=0.5mi, 1600=1mi, 8000=5mi)
      
      6. After they've selected places, summarize their full itinerary.
      
      Be friendly and concise. Ask ONE question at a time. Format responses in markdown.`,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('API ROUTE ERROR:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
