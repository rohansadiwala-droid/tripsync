import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Itinerary } from '../types';

// 1. Updated to the Vite-specific environment variable syntax
const apiKey = import.meta.env.VITE_API_KEY; 

if (!apiKey) {
  throw new Error("API_KEY environment variable not set");
}

const genAI = new GoogleGenerativeAI(apiKey);
const ai = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Function 1: For the Trip Planner
export async function generateItinerary(destination: string, duration: number, interests: string): Promise<Itinerary> {
  const prompt = `Create a ${duration}-day travel itinerary for ${destination} focusing on ${interests}. Return ONLY a valid JSON object with an 'itinerary' array.`;
  
  try {
    const result = await ai.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // CRASH-PROOFING: Extract only the JSON block, ignoring conversational text
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("AI did not return a valid data format.");
    }
    
    return JSON.parse(jsonMatch[0]);
    
  } catch (error: any) {
    console.error("AI Error Details:", error);
    // Ensure we throw a safe string, not an object that crashes React
    throw new Error(error.message || "Failed to generate itinerary.");
  }
}

// ... Keep your other two functions (getConversionRates & generatePackingSuggestions) below ...

// Function 2: For the Expense Splitter
export async function getConversionRates(baseCurrency: string, targetCurrencies: string[]) {
  try {
    const prompt = `Provide the current exchange rates from ${baseCurrency} to ${targetCurrencies.join(', ')}. Return ONLY a valid JSON object where keys are currency codes and values are the numerical exchange rate.`;
    const result = await ai.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to fetch conversion rates:", error);
    return {};
  }
}

// Function 3: For the Shared Packing Lists
export async function generatePackingSuggestions(destination: string, duration: number) {
  try {
    const prompt = `Suggest a packing list for a ${duration}-day trip to ${destination}. Return ONLY a valid JSON array of strings, where each string is a packing item.`;
    const result = await ai.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to fetch packing suggestions:", error);
    return [];
  }
}
