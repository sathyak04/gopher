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
      
      Step 1: Identify the event the user is interested in (Artist/Team + City + Date).
      Step 2: Once the event is confirmed (you can assume it exists for now), ask for preferences:
      - Budget (Cheap, Moderate, Expensive)
      - Rating (e.g., 4.0+)
      - Radius (walking distance vs driving)
      - Cuisine types or Hotel preferences.
  
      Be concise and helpful. formatting your response in markdown.`,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('API ROUTE ERROR:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
