import { GoogleGenAI } from "@google/genai";
import { StructureModel, AnalysisResults } from "../frame/types";

export const analyzeStructureWithAI = async (
  model: StructureModel,
  userQuery?: string,
  analysisResults?: AnalysisResults
) => {
  if (!process.env.API_KEY) {
    return "### API Key Missing\n\nIt looks like you haven't configured your Google Gemini API key yet.\n\n1. Create a `.env` file in your project root.\n2. Add `API_KEY=your_actual_key_here`.\n3. Restart the server.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      
      App Interface Context (How users use this app):
      - Users interact with a GUI (Graphical User Interface), NOT code.
      - Sidebar: Users define Nodes (coordinates), Members (connecting nodes), Supports (pin/roller/fixed), and Loads here.
      - Canvas: The central area displays the 2D structure visualization.
      - Analyze Button: Users click the "Play" icon/Analyze button in the header to run the matrix stiffness solver.
      - Report: Users can generate a PDF report after analysis.

      Context:
      ${context}
      
      ${userQuery ? `User Question: "${userQuery}"` : 'Please provide a structural assessment. If the numerical analysis succeeded, explain the load path and reaction forces. If it failed, explain why the structure might be unstable.'}
      
      Guidelines:
      1. Be concise and professional.
      2. Use Markdown.
      3. If asked "how to use", explain the GUI steps (Sidebar -> Add Nodes/Members -> Analyze), DO NOT tell them to write JSON.
      4. If the analysis failed (unstable), suggest where to add supports.
      5. Highlight maximum reactions if available.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are StructureRealm AI. Use the provided JSON data and numerical results to answer structural engineering questions accurately. Do not ask users to write code.",
      }
    });

    return response.text || "No response text generated.";
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Error generating analysis. Please check your network connection and API key quota.";
  }
};