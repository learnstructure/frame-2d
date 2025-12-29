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

    // 1. Serialize Model with ENGINEERING PROPERTIES
    const engineeredModel = {
      nodes: model.nodes,
      members: model.members.map(m => ({
        id: m.id,
        type: m.type,
        start: m.startNodeId,
        end: m.endNodeId,
        // Critical properties for stiffness
        E: m.eModulus?.toExponential(2),
        A: m.area?.toExponential(4),
        I: m.momentInertia?.toExponential(6),
        k: m.springConstant
      })),
      supports: model.supports,
      loads: model.loads
    };

    let context = `Structure Definition (Engineering Model):\n${JSON.stringify(engineeredModel, null, 2)}\n\n`;

    // 2. Serialize Results with FORCES and MATRICES
    if (analysisResults) {
      if (analysisResults.isStable) {
        // Calculate max displacement for context summary
        let maxDisp = 0;
        let maxNode = "none";
        const dispData: Record<string, string> = {};

        Object.entries(analysisResults.displacements).forEach(([nodeId, d]) => {
          const mag = Math.sqrt(d.x ** 2 + d.y ** 2);
          if (mag > maxDisp) {
            maxDisp = mag;
            maxNode = nodeId;
          }
          dispData[nodeId] = `[dx:${d.x.toExponential(3)}, dy:${d.y.toExponential(3)}, rad:${d.rotation.toExponential(3)}]`;
        });

        context += `Analysis Results (FEM):\n`;
        context += `- Status: Stable\n`;
        context += `- Max Displacement: ${maxDisp.toExponential(3)} at Node ${maxNode}\n\n`;

        context += `Nodal Displacements (dx, dy, rotation):\n${JSON.stringify(dispData, null, 2)}\n\n`;

        context += `Support Reactions (Fx, Fy, Moment):\n${JSON.stringify(analysisResults.reactions, null, 2)}\n\n`;

        // Member Forces are critical for internal checks
        context += `Member Internal Forces (Local Coordinates):\n`;
        context += `Note: fx=Axial (+=Tension), fy=Shear, moment=Bending\n`;
        context += `${JSON.stringify(analysisResults.memberForces, null, 2)}\n\n`;

        // Stiffness Matrix (K)
        if (analysisResults.stiffnessMatrix) {
          if (model.nodes.length <= 8) {
            context += `Global Stiffness Matrix (K) [Size: ${analysisResults.stiffnessMatrix.length}x${analysisResults.stiffnessMatrix.length}]:\n`;
            context += JSON.stringify(analysisResults.stiffnessMatrix);
            context += `\n\n`;
          } else {
            context += `Global Stiffness Matrix (K): [Omitted due to size: ${analysisResults.stiffnessMatrix.length}x${analysisResults.stiffnessMatrix.length}]\n\n`;
          }
        }

      } else {
        context += `Analysis Error: ${analysisResults.message}\n\n`;
      }
    }

    const prompt = `
      You are an expert structural engineer assistant for "StructureRealm".
      
      Your goal is to provide precise, technical, and quantitative answers based on the provided FEM data.
      
      App Context:
      - 2D Matrix Stiffness Method Solver.
      - Units are consistent based on user input (typically SI: N, m, Pa or Imperial: lb, in, psi).
      
      ENGINEERING DATA:
      ${context}
      
      ${userQuery ? `User Question: "${userQuery}"` : 'Please provide a detailed structural assessment. Audit the stiffness, check the load path, and interpret the member forces.'}
      
      Guidelines:
      1. **Be Quantitative:** Cite specific force values, displacements, and node IDs in your explanation.
      2. **Interpret Forces:** Explain what the axial/shear/moment values imply (e.g., "Member m1 is in significant compression...").
      3. **Check Stiffness:** If the stiffness matrix is provided, briefly comment on its diagonal dominance or condition if asked.
      4. **Stability:** If unstable, analyze the support conditions or mechanism.
      5. Use Markdown for formatting tables or math.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a senior structural analyst. You analyze JSON structural models and stiffness matrices to give expert engineering advice.",
      }
    });

    return response.text || "No response text generated.";
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Error generating analysis. Please check your network connection and API key quota.";
  }
};