
import { GoogleGenAI } from "@google/genai";
import { StructureModel, AnalysisResults } from "../frame/types";

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const analyzeStructureWithAI = async (
  model: StructureModel,
  history: Message[],
  analysisResults?: AnalysisResults
) => {
  if (!process.env.API_KEY) {
    return "### API Key Missing\n\nIt looks like you haven't configured your Google Gemini API key yet.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Normalize model for the AI to understand properties better using full names
    const engineeredModel = {
      nodes: model.nodes || [],
      members: (model.members || []).map(m => ({
        id: m.id,
        type: m.type,
        startNodeId: m.startNodeId,
        endNodeId: m.endNodeId,
        eModulus: m.eModulus,
        area: m.area,
        momentInertia: m.momentInertia,
        springConstant: m.springConstant
      })),
      supports: model.supports || [],
      loads: model.loads || []
    };

    let structuralContext = `CURRENT STRUCTURAL MODEL:\n${JSON.stringify(engineeredModel, null, 2)}\n\n`;

    if (analysisResults) {
      if (analysisResults.isStable) {
        structuralContext += `ANALYSIS RESULTS (FEM):\n`;
        structuralContext += `- Nodal Displacements: ${JSON.stringify(analysisResults.displacements)}\n`;
        structuralContext += `- Support Reactions: ${JSON.stringify(analysisResults.reactions)}\n`;
        structuralContext += `- Member Internal Forces: ${JSON.stringify(analysisResults.memberForces)}\n\n`;
      } else {
        structuralContext += `ANALYSIS FAILED: ${analysisResults.message}\n\n`;
      }
    }

    const devProfile = `
      DEVELOPER IDENTITY:
      - Creator: Abinash Mandal
      - Role: PhD Researcher and Student at the University of Nevada, Reno (UNR).
      - LinkedIn: https://www.linkedin.com/in/abinash-mandal-90132b238/
      - GitHub: https://github.com/learnstructure
      - Email: abinashmandal33486@gmail.com
    `;

    const modelingAgentInstructions = `
      MODELING AGENT CAPABILITIES:
      You can directly build or modify structural models. To do so, you MUST include a JSON block in your response.
      ALWAYS wrap the JSON in markdown code blocks:
      \`\`\`json
      {"action": "SET_MODEL", "payload": {"nodes": [...], "members": [...], "supports": [...], "loads": [...]}}
      \`\`\`
      
      CRITICAL SCHEMA RULES (MANDATORY):
      1. Members MUST use keys: 'id', 'type' ('beam'|'truss'|'spring'), 'startNodeId', 'endNodeId'.
      2. Support MUST use keys: 'id', 'nodeId', 'type' ('pin'|'roller'|'fixed').
      3. Load MUST use EXACT keys: 
         - 'id': unique string (e.g., 'l1')
         - 'type': 'nodal_point', 'member_point', or 'member_distributed'
         - 'nodeId': (required for nodal_point) 
         - 'memberId': (required for member_point/member_distributed)
         - 'magnitudeX': horizontal force (positive is right)
         - 'magnitudeY': vertical force (positive is up)
         - 'moment': moment (positive is counter-clockwise)
         - 'location': distance from start node (only for member_point)
      4. Units as specified by the user. Otherwise x, y in meters & Forces in kiloNewtons (kN).
      5. Always provide the FULL model state in the payload.
    `;

    const systemInstruction = `
      You are the "StructureRealm" Engineering AI.
      
      ${devProfile}

      ROLE:
      Expert structural analyst and generative modeling agent.
      
      ${modelingAgentInstructions}
      
      ${structuralContext}
    `;

    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text || "No response text generated.";
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Error generating analysis. Please check your connection.";
  }
};
