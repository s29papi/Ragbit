// Handles 0G Compute Network AI operations
import axios from 'axios';
import crypto from 'crypto';

class ZeroGAIService {
    constructor() {
        this.computeEndpoint = process.env.OG_COMPUTE_ENDPOINT || 'https://compute-api-testnet.0g.ai';
        this.apiKey = process.env.OG_COMPUTE_KEY || '';
        this.model = '0g-llm-7b';
    }

    async generateAnswer(query, chunks) {
        try {
            // Format context from chunks
            const context = chunks.map((c, i) => 
                `[Chunk ${c.id}]: ${c.text}`
            ).join('\n\n');

            // Call 0G Compute Network
            const response = await axios.post(
                `${this.computeEndpoint}/v1/inference`,
                {
                    model: this.model,
                    messages: [
                        {
                            role: "system",
                            content: "Answer based on the provided context. Be accurate and cite chunk IDs."
                        },
                        {
                            role: "user",
                            content: `Context:\n${context}\n\nQuestion: ${query}`
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.3
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                answer: response.data.choices[0].message.content,
                model: this.model,
                tokensUsed: response.data.usage?.total_tokens || 0
            };
        } catch (error) {
            // Fallback if 0G Compute unavailable
            console.log("0G Compute unavailable, using fallback");
            return this.fallbackAnswer(query, chunks);
        }
    }

    fallbackAnswer(query, chunks) {
        // Simple extractive fallback
        const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 3);
        const relevantSentences = [];
        
        chunks.forEach(chunk => {
            const sentences = chunk.text.split(/[.!?]+/);
            sentences.forEach(sentence => {
                const sentLower = sentence.toLowerCase();
                const matches = queryWords.filter(word => sentLower.includes(word)).length;
                if (matches >= 2) {
                    relevantSentences.push(sentence.trim());
                }
            });
        });
        
        const answer = relevantSentences.length > 0 
            ? relevantSentences.slice(0, 3).join('. ') + '.'
            : "No relevant information found in the dataset.";
            
        return {
            answer,
            model: 'fallback',
            tokensUsed: 0
        };
    }

    generateProofHash(answer, chunks) {
        const proofData = {
            answer,
            chunkIds: chunks.map(c => c.id),
            timestamp: Date.now(),
            model: this.model
        };
        return '0x' + crypto.createHash('sha256')
            .update(JSON.stringify(proofData))
            .digest('hex');
    }
}

export default ZeroGAIService;