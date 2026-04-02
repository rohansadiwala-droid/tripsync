
import { GoogleGenAI, Type } from "@google/genai";
import type { Itinerary } from '../types';

// Ensure the API key is available from environment variables
if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const itinerarySchema = {
    type: Type.OBJECT,
    properties: {
        itinerary: {
            type: Type.ARRAY,
            description: "An array of daily plans for the trip.",
            items: {
                type: Type.OBJECT,
                properties: {
                    day: { type: Type.STRING, description: "e.g., Day 1" },
                    title: { type: Type.STRING, description: "A catchy title for the day's theme." },
                    activities: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "List of 3-4 key activities and places to visit."
                    },
                    food: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "List of 2-3 restaurant or food suggestions for the day (e.g., Breakfast, Lunch, Dinner)."
                    }
                },
                 required: ["day", "title", "activities", "food"]
            }
        }
    },
    required: ["itinerary"]
};

export async function generateItinerary(
    destination: string,
    duration: number,
    interests: string
): Promise<Itinerary> {
    const prompt = `
        Create a ${duration}-day travel itinerary for a trip to ${destination}.
        The traveler is interested in: ${interests}.
        For each day, provide a title, a list of activities, and some food suggestions.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "You are an expert travel agent. Generate a detailed, day-by-day travel itinerary based on the user's request. You must strictly adhere to the provided JSON schema and only output valid JSON.",
                responseMimeType: "application/json",
                responseSchema: itinerarySchema,
            },
        });
        
        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);

        // Basic validation to ensure the response matches the expected structure
        if (parsedResponse && Array.isArray(parsedResponse.itinerary)) {
            return { destination, ...parsedResponse } as Itinerary;
        } else {
            console.error("Invalid response structure from Gemini API:", parsedResponse);
            throw new Error("Received an invalid itinerary structure from the AI.");
        }

    } catch (error) {
        console.error("Error generating itinerary:", error);
        if (error instanceof SyntaxError) {
            // This catches JSON.parse errors
            console.error("Failed to parse JSON response from Gemini API.");
            throw new Error("The AI returned an invalid response format. Please try again.");
        }
        // Handle other potential errors from the API call itself
        throw new Error("An unexpected error occurred while communicating with the AI service.");
    }
}

export async function getConversionRates(
    baseCurrency: string,
    targetCurrencies: string[]
): Promise<Record<string, number>> {
    const prompt = `
        Provide the current conversion rates for the following currencies. The rate should represent
        how many units of the base currency (${baseCurrency}) are equivalent to one unit of the target currency.
        
        Target currencies: ${targetCurrencies.join(', ')}.

        For example, if the base currency is USD and a target is EUR, and 1 EUR = 1.08 USD, the rate for EUR should be 1.08.
    `;
    
    // Dynamically create properties for the schema based on targetCurrencies
    const currencyProperties = targetCurrencies.reduce((acc, curr) => {
        acc[curr] = { 
            type: Type.NUMBER,
            description: `The conversion rate for 1 ${curr} to ${baseCurrency}`
        };
        return acc;
    }, {} as Record<string, { type: Type; description: string }>);

    const ratesSchema = {
        type: Type.OBJECT,
        properties: {
            rates: {
                type: Type.OBJECT,
                description: `An object where keys are currency codes and values are the conversion rates to ${baseCurrency}.`,
                properties: currencyProperties,
            }
        },
        required: ["rates"]
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "You are a helpful currency conversion assistant. You must provide accurate conversion rates and strictly follow the provided JSON schema.",
                responseMimeType: "application/json",
                responseSchema: ratesSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);

        if (parsedResponse && parsedResponse.rates) {
            return parsedResponse.rates;
        } else {
            console.error("Invalid rates structure from Gemini API:", parsedResponse);
            throw new Error("AI returned an invalid rate structure.");
        }

    } catch (error) {
        console.error("Error fetching conversion rates:", error);
        if (error instanceof SyntaxError) {
            throw new Error("The AI returned an invalid response format for rates. Please try again.");
        }
        throw new Error("Could not fetch conversion rates from the AI service.");
    }
}

const packingSuggestionsSchema = {
    type: Type.OBJECT,
    properties: {
        suggestions: {
            type: Type.ARRAY,
            description: "An array of strings, where each string is a suggested packing item.",
            items: { type: Type.STRING }
        }
    },
    required: ["suggestions"]
};

export async function generatePackingSuggestions(itinerary: Itinerary): Promise<string[]> {
    const duration = itinerary.itinerary.length;
    const activitiesSummary = itinerary.itinerary.map(day => `On ${day.day}, activities include ${day.activities.join(', ')}`).join('; ');

    const prompt = `
        Based on a ${duration}-day trip to ${itinerary.destination}, with planned activities such as: ${activitiesSummary},
        suggest a concise list of essential items to pack.
        Focus on clothing, toiletries, electronics, and documents.
        Do not include obvious items like "underwear" or "socks" unless they are specific (e.g., "wool socks for hiking").
        Return around 10-15 items.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: "You are a travel planning assistant. Provide a packing list as a JSON array of strings based on the user's itinerary. You must strictly adhere to the provided JSON schema.",
                responseMimeType: "application/json",
                responseSchema: packingSuggestionsSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const parsedResponse = JSON.parse(jsonText);

        if (parsedResponse && Array.isArray(parsedResponse.suggestions)) {
            return parsedResponse.suggestions;
        } else {
            console.error("Invalid packing suggestions structure from Gemini API:", parsedResponse);
            throw new Error("AI returned an invalid suggestion structure.");
        }

    } catch (error) {
        console.error("Error generating packing suggestions:", error);
        if (error instanceof SyntaxError) {
            throw new Error("The AI returned an invalid response format for packing suggestions.");
        }
        throw new Error("Could not fetch packing suggestions from the AI service.");
    }
}