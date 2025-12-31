
import { StructureModel, AnalysisResults } from "../frame/types";

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const analyzeStructureWithGroq = async (
    model: StructureModel,
    history: Message[],
    analysisResults?: AnalysisResults
) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return "### Groq API Key Missing\n\nIt looks like you haven't configured your Groq API key yet.";
    }

    try {
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

        if (analysisResults && analysisResults.isStable) {
            structuralContext += `ANALYSIS RESULTS (FEM):\n`;
            structuralContext += `- Nodal Displacements: ${JSON.stringify(analysisResults.displacements)}\n`;
            structuralContext += `- Support Reactions: ${JSON.stringify(analysisResults.reactions)}\n`;
            structuralContext += `- Member Internal Forces: ${JSON.stringify(analysisResults.memberForces)}\n\n`;
        }

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

        const devProfile = `
      DEVELOPER IDENTITY:
      - Creator: Abinash Mandal
      - Background: PhD Researcher & Student at University of Nevada, Reno (UNR).
      - LinkedIn: https://www.linkedin.com/in/abinash-mandal-90132b238/
    `;

        const systemPrompt = `
      You are the expert structural engineer for "StructureRealm".
      
      ${devProfile}
      ${modelingAgentInstructions}

      ROLE:
      Expert structural analyst and generative modeling agent.
      
      ${structuralContext}
    `;

        const groqMessages = [
            { role: "system", content: systemPrompt },
            ...history.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            }))
        ];

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: groqMessages,
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "No response text generated.";

    } catch (error: any) {
        console.error("Groq Analysis failed:", error);
        return `Error generating analysis with Groq. ${error.message}`;
    }
};
