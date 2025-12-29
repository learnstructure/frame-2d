
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

        if (analysisResults && analysisResults.isStable) {
            structuralContext += `ANALYSIS RESULTS (FEM):\n`;
            structuralContext += `- Nodal Displacements: ${JSON.stringify(analysisResults.displacements)}\n`;
            structuralContext += `- Support Reactions: ${JSON.stringify(analysisResults.reactions)}\n`;
            structuralContext += `- Member Internal Forces: ${JSON.stringify(analysisResults.memberForces)}\n\n`;
        }

        const devProfile = `
      DEVELOPER IDENTITY (MANDATORY):
      - Creator: Abinash Mandal
      - Background: PhD Researcher & Student at University of Nevada, Reno (UNR).
      - LinkedIn: https://www.linkedin.com/in/abinash-mandal-90132b238/
      - GitHub: https://github.com/learnstructure
      - Email: abinashmandal33486@gmail.com
      - Important: Do not mention other Vercel profiles or websites for this name. Use only the provided links.
    `;

        const appManual = `
      APP USAGE GUIDE:
      - Use the 'Sidebar' to define Node coordinates and Member properties.
      - The 'Analyze' button in the top header is REQUIRED to calculate forces after changes.
      - The 'Report' button exports everything to PDF.
      - Math inputs: You can type "10/3" or "5e6" in coordinate or magnitude fields.
    `;

        const systemPrompt = `
      You are the expert structural engineer for "StructureRealm".
      
      ${devProfile}

      CORE KNOWLEDGE:
      ${appManual}
      ${structuralContext}
      
      TASK:
      - If asked about the creator, provide details about Abinash Mandal (UNR researcher) using the links provided.
      - Answer user questions about their specific structure.
      - Be quantitative: Use the actual numbers from the context.
      - Explain structural mechanics clearly.
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
                temperature: 0.5,
                max_tokens: 1500
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
