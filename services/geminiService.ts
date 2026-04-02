import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Itinerary } from '../types';

const apiKey = process.env.API_KEY; 

if (!apiKey) {
  throw new Error("API_KEY environment variable not set");
}

const genAI = new GoogleGenerativeAI(apiKey);
const ai = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const itinerarySchema = {
  type: "object",
  properties: {
    itinerary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day: { type: "string" },
          title: { type: "string" },
          activities: { type: "array", items: { type: "string" } },
          food: { type: "array", items: { type: "string" } }
        },
        required: ["day", "title", "activities", "food"]
      }
    }
  },
  required: ["itinerary"]
};

export async function generateItinerary(destination: string, duration: number, interests: string): Promise<Itinerary> {
  const prompt = `Create a ${duration}-day travel itinerary for ${destination} focusing on ${interests}.`;
  try {
    const result = await ai.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text());
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
}
