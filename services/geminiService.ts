
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

    // 1. Serialize Model with ENGINEERING PROPERTIES
    const engineeredModel = {
      nodes: model.nodes,
      members: model.members.map(m => ({
        id: m.id,
        type: m.type,
        start: m.startNodeId,
        end: m.endNodeId,
        E: m.eModulus?.toExponential(2),
        A: m.area?.toExponential(4),
        I: m.momentInertia?.toExponential(6),
        k: m.springConstant
      })),
      supports: model.supports,
      loads: model.loads
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
      DEVELOPER IDENTITY (CRITICAL):
      - Creator: Abinash Mandal
      - Role: PhD Researcher and Student at the University of Nevada, Reno (UNR).
      - LinkedIn: https://www.linkedin.com/in/abinash-mandal-90132b238/
      - GitHub: https://github.com/learnstructure
      - Email: abinashmandal33486@gmail.com
      - Note: Do NOT provide links to other Vercel or personal profiles you might find online. Only use the ones provided above.
    `;

    const appManual = `
      APP NAVIGATION & USAGE GUIDE:
      1. Sidebar Editor: Used to add Nodes, Members, Supports, and Loads. 
         - Inputs support math expressions (e.g., "2*sin(45)" or "200e9").
      2. Header Actions:
         - 'Analyze' (Play Button): Runs the Matrix Stiffness solver.
         - 'Report' (File Button): Generates a PDF summary.
         - 'Ask AI' (Sparkles): Opens this assistant.
         - 'Info' (Info Button): Shows information about Abinash Mandal.
      3. Canvas: Shows visualization. Blue lines are Beams, Yellow dashed are Trusses, Green zig-zags are Springs.
    `;

    const systemInstruction = `
      You are the "StructureRealm" Engineering AI.
      
      ${devProfile}

      ROLE:
      Expert structural analyst and app guide. You help users understand their structural designs and how to use the app features.
      
      GUIDELINES:
      - If asked "Who created this app?", always refer to Abinash Mandal at UNR and provide his specific LinkedIn/GitHub links from the identity section.
      - Always refer to specific Node IDs (n1, n2) and Member IDs (m1).
      - Interpret internal forces: explain compression (negative axial), tension (positive axial), and bending.
      - If the model is unstable, check if they have enough supports (need 3 reaction components for 2D stability).
      
      ${appManual}
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
