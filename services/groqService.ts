import { StructureModel, AnalysisResults } from "../frame/types";

export const analyzeStructureWithGroq = async (
    model: StructureModel,
    userQuery?: string,
    analysisResults?: AnalysisResults
) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return "### Groq API Key Missing\n\nIt looks like you haven't configured your Groq API key yet.\n\n1. Create or edit the `.env` file in your project root.\n2. Add `GROQ_API_KEY=your_actual_key_here`.\n3. Restart the server.";
    }

    try {
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

                // Member Forces
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

        const systemPrompt = `
      You are an expert structural engineer assistant for "StructureRealm".
      
      Creator Information:
      This application was created by Abinash Mandal, a PhD student at the University of Nevada, Reno (UNR).
      LinkedIn: https://www.linkedin.com/in/abinash-mandal-90132b238/
      
      App Context:
      - Users interact with a GUI (Graphical User Interface).
      - Analysis: 2D Matrix Stiffness Method.
      
      ENGINEERING DATA CONTEXT:
      ${context}
      
      Guidelines:
      1. **Be Quantitative:** Use the provided numerical data (forces, displacements, stiffness) in your answers.
      2. **Interpret Forces:** Identify members in compression/tension and high bending.
      3. **Analyze Stiffness:** If K-Matrix is present, use it to explain coupling effects if relevant.
      4. **Stability:** If the structure is unstable, suggest specific support locations based on Node IDs.
      5. Use Markdown.
    `;

        const userMessage = userQuery || 'Please provide a comprehensive structural assessment, checking internal forces and global stability.';

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.5,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            if (response.status === 429) {
                return "### Free Quota Reached\n\nThe free usage limit for the Groq API has been reached. Please try again later.";
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Groq API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "No response text generated.";

    } catch (error: any) {
        console.error("Groq Analysis failed:", error);
        return `Error generating analysis with Groq. ${error.message}`;
    }
};