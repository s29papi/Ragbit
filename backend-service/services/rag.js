// Orchestrates the RAG flow
import { ethers } from 'ethers';

class RAGService {
    constructor(storageService, aiService, contractService) {
        this.storage = storageService;
        this.ai = aiService;
        this.contract = contractService;
    }

    async processQuery(query, datasetHash, userAddress) {
        // 1. Check user balance
        const balance = await this.contract.getUserBalance(userAddress);
        
        // 2. Get dataset info
        const datasetInfo = await this.contract.getDatasetInfo(datasetHash);
        if (!datasetInfo.active) {
            return {
                status: 400,
                body: { error: 'Dataset not active' }
            };
        }
        
        // 3. Find relevant chunks
        const chunks = await this.storage.searchRelevantChunks(
            datasetHash, 
            query, 
            5
        );
        
        if (chunks.length === 0) {
            return {
                status: 404,
                body: { error: 'No relevant information found' }
            };
        }
        
        // 4. Calculate cost
        const totalCost = chunks.length * datasetInfo.pricePerChunk;
        
        // 5. Check sufficient balance
        if (balance < totalCost) {
            return {
                status: 402,
                headers: {
                    'X-Payment-Required': true,
                    'X-Payment-Contract': this.contract.address,
                    'X-Required-Amount': ethers.formatEther(totalCost),
                    'X-Current-Balance': ethers.formatEther(balance),
                    'X-Chunks-Count': chunks.length
                },
                body: {
                    error: 'Insufficient balance',
                    required: ethers.formatEther(totalCost),
                    balance: ethers.formatEther(balance)
                }
            };
        }
        
        // 6. Generate answer using 0G AI
        const { answer, model, tokensUsed } = await this.ai.generateAnswer(query, chunks);
        
        // 7. Create proof hash
        const answerHash = this.ai.generateProofHash(answer, chunks);
        
        // 8. Record proof on-chain (server pays gas, user pays for chunks)
        const proofId = await this.contract.recordProof(
            answerHash,
            datasetHash,
            chunks.map(c => c.id),
            userAddress,
            model
        );
        
        return {
            status: 200,
            body: {
                answer,
                citations: chunks.map(c => ({
                    chunkId: c.id,
                    excerpt: c.text.substring(0, 150) + '...',
                    score: c.score
                })),
                proof: {
                    id: proofId,
                    answerHash,
                    datasetHash,
                    chunksUsed: chunks.length,
                    cost: ethers.formatEther(totalCost),
                    model,
                    tokensUsed
                }
            }
        };
    }
}

export default RAGService;