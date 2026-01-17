import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    console.log('Chat request with', messages.length, 'messages');

    const result = await streamText({
      model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
      system: `You are an event planner helping users find hotels and restaurants near events.

CRITICAL RULES:
1. For greetings (hi, hello), respond normally.
1. For greetings (hi, hello), respond normally.
2. When user mentions an artist/event they want to see, IMMEDIATELY response with "Searching for events..." and include EXACTLY this format:
   [SEARCH_EVENT: name]
   
   examples:
   User: "Drake" -> [SEARCH_EVENT: Drake]
   User: "Taylor Swift" -> [SEARCH_EVENT: Taylor Swift]
   
   NEVER use other formats like [Drake_Event] or [DRAW_Event].

3. **EVENT SELECTION Handling**:
   When user says "I want to attend: [Event Name]...", DO NOT ask what event they want. You already know.
   IMMEDIATELY response: "Great choice! [ASK_HOTELS] Would you like to look for hotels nearby?"
   
   CRITICAL: You MUST include [ASK_HOTELS] in the response. This triggers the UI buttons.

4. **HOTEL SEARCH Trigger**:
   When user asks for hotels or gives hotel preferences, include this trigger:
   [FIND_PLACES: type=hotel | budget=cheap | rating=4 | radius=8000]

   - budget: cheap, moderate, expensive
   - rating: 0-5
   - radius: 800 (walking), 1600 (nearby), 8000 (driving)

5. **RESTAURANT SEARCH Trigger**:
   When user asks for restaurants, FIRST ask: "Should they be near the venue or near your hotel?" unless already specified.
   Then ask for cuisine/budget.
   When preferences given:
   [FIND_PLACES: type=restaurant | budget=moderate | rating=4 | radius=1600]

IMPORTANT:
- NEVER ask "what event" after the user just selected one.
- You can search for restaurants OR hotels in any order.
- ALWAYS include [FIND_PLACES: ...] when preferences are given.`,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('API ROUTE ERROR:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
