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

        const systemPrompt = `
      You are an expert structural engineer assistant for "StructureRealm".
      
      Creator Information:
      This application was created by Abinash Mandal, a PhD student at the University of Nevada, Reno (UNR).
      LinkedIn: https://www.linkedin.com/in/abinash-mandal-90132b238/
      
      Context:
      ${context}
      
      Guidelines:
      1. Be concise and professional.
      2. Use Markdown.
      3. If the analysis failed (unstable), suggest where to add supports.
      4. Highlight maximum reactions if available.
      5. If the user asks about the creator or author, provide Abinash's details and LinkedIn link.
    `;

        const userMessage = userQuery || 'Please provide a structural assessment. If the numerical analysis succeeded, explain the load path and reaction forces. If it failed, explain why the structure might be unstable.';

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
                // Llama 3 70B is excellent for reasoning tasks
                model: "llama-3.3-70b-versatile",
                temperature: 0.5,
                max_tokens: 1024
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