import { GoogleGenAI } from "@google/genai";
import { StructureModel } from "../frame/types";

// Helper to safely get the key (Vite replaces process.env.API_KEY)
const getApiKey = () => process.env.API_KEY;

export const analyzeStructureWithAI = async (model: StructureModel, userQuery?: string) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return "### API Key Missing\n\nIt looks like you haven't configured your Google Gemini API key yet.\n\n1. Create a `.env` file in your project root.\n2. Add `API_KEY=your_actual_key_here`.\n3. Restart the server.";
  }

  try {
    // Initialize inside the function to prevent app crash if key is missing on load
    const ai = new GoogleGenAI({ apiKey });

    const modelJson = JSON.stringify(model, null, 2);

    const prompt = `
      You are an expert structural engineer. 
      Analyze the following 2D structural frame defined in JSON format.
      
      Structure Data:
      ${modelJson}
      
      ${userQuery ? `User Question: ${userQuery}` : 'Provide a general analysis of this structure. Identify potential stability issues, describe the load path, and estimate where maximum stresses might occur qualitatively.'}
      
      Keep the response concise, professional, and formatted with Markdown. Use bullet points for key observations.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are StructureRealm AI, a helpful assistant for structural analysis.",
      }
    });

    return response.text || "No response text generated.";
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Error generating analysis. Please check your network connection and API key quota.";
  }
};