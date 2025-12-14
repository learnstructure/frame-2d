import { GoogleGenAI } from "@google/genai";
import { StructureModel, AnalysisResults } from "../frame/types";

// Helper to safely get the key (Vite replaces process.env.API_KEY)
const getApiKey = () => process.env.API_KEY;

export const analyzeStructureWithAI = async (
  model: StructureModel,
  userQuery?: string,
  analysisResults?: AnalysisResults
) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return "### Feature not available right now.\n\nThis feature will soon be implemented once API access is secured.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Filter circular references if any, or just pick essential data to save tokens
    const simplifiedModel = {
      nodes: model.nodes.length,
      members: model.members.map(m => ({ id: m.id, type: m.type, start: m.startNodeId, end: m.endNodeId })),
      supports: model.supports,
      loads: model.loads
    };

    let context = `Structure Definition (JSON):\n${JSON.stringify(simplifiedModel, null, 2)}\n\n`;

    if (analysisResults) {
      if (analysisResults.isStable) {
        context += `Calculated Results:\n- Max Displacement: Check displacements object.\n- Reactions: ${JSON.stringify(analysisResults.reactions)}\n\n`;
      } else {
        context += `Analysis Error: ${analysisResults.message}\n\n`;
      }
    }

    const prompt = `
      You are an expert structural engineer assistant for "StructureRealm".
      
      Context:
      ${context}
      
      ${userQuery ? `User Question: "${userQuery}"` : 'Please provide a structural assessment. If the numerical analysis succeeded, explain the load path and reaction forces. If it failed, explain why the structure might be unstable.'}
      
      Guidelines:
      1. Be concise and professional.
      2. Use Markdown.
      3. If the analysis failed (unstable), suggest where to add supports.
      4. Highlight maximum reactions if available.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are StructureRealm AI. Use the provided JSON data and numerical results to answer structural engineering questions accurately.",
      }
    });

    return response.text || "No response text generated.";
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Error generating analysis. Please check your network connection and API key quota.";
  }
};