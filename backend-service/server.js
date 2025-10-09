import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs/promises';

// Import all services
import StorageService from './services/storage.js';
import ZeroGAIService from './services/0gAI.js';
import RAGService from './services/rag.js';
import ContractService from './services/contract.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Multer for file uploads
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Contract ABI
const CONTRACT_ABI = [
    "function publishDataset(bytes32 _rootHash, string _metadataURI, uint256 _pricePerChunk, uint256 _totalChunks)",
    "function deposit() payable",
    "function userBalances(address) view returns (uint256)",
    "function getDatasetInfo(bytes32) view returns (address publisher, string metadataURI, uint256 pricePerChunk, bytes32 rootHash, uint256 totalChunks, bool active)",
    "function recordProof(bytes32 _answerHash, bytes32 _datasetHash, uint256[] _chunkIds, address _user, string _modelUsed) returns (uint256)",
    "function proofs(uint256) view returns (bytes32 answerHash, bytes32 datasetHash, uint256[] chunkIds, address user, uint256 timestamp, uint256 amountPaid, string modelUsed)",
    "function withdraw()",
    "function authorizedServices(address) view returns (bool)",
    "function getUserBalance(address) view returns (uint256)"
];

// Initialize all services
const storage = new StorageService(process.env.PRIVATE_KEY);
const ai = new ZeroGAIService();
const contract = new ContractService(
    process.env.CONTRACT_ADDRESS,
    CONTRACT_ABI,
    process.env.PRIVATE_KEY
);
const rag = new RAGService(storage, ai, contract);

// Startup check
app.listen(process.env.PORT || 3000, async () => {
    const PORT = process.env.PORT || 3000;
    
    // Check if server is authorized
    try {
        const isAuthorized = await contract.isAuthorized();
        if (!isAuthorized) {
            console.warn('⚠️  WARNING: Server wallet is not authorized to record proofs!');
            console.warn('   Ask contract owner to call: authorizeService(' + contract.wallet.address + ')');
        } else {
            console.log('✅ Server wallet is authorized');
        }
    } catch (error) {
        console.error('❌ Cannot connect to contract:', error.message);
    }
    
    console.log(`🔷 RAGbits Exchange API running on port ${PORT}`);
    console.log(`📍 Contract: ${process.env.CONTRACT_ADDRESS}`);
    console.log(`🌐 Network: 0G Testnet`);
    console.log(`👛 Server Wallet: ${contract.wallet.address}`);
});

// Health check
app.get('/health', async (req, res) => {
    const isAuthorized = await contract.isAuthorized().catch(() => false);
    res.json({ 
        status: 'healthy',
        network: '0G Testnet',
        contract: process.env.CONTRACT_ADDRESS,
        serverWallet: contract.wallet.address,
        authorized: isAuthorized
    });
});

// Publish dataset endpoint
app.post('/api/publish', upload.single('dataset'), async (req, res) => {
    try {
        const { publisherAddress, metadata, pricePerChunk } = req.body;

        console.log(publisherAddress, metadata, pricePerChunk)
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        if (!publisherAddress || !metadata || !pricePerChunk) {
            return res.status(400).json({ 
                error: 'Missing required fields: publisherAddress, metadata, pricePerChunk' 
            });
        }
        
        // Upload to 0G Storage (server pays for storage)
        console.log('Uploading to 0G Storage...');
        const uploadResult = await storage.uploadDataset(
            req.file.path,
            metadata
        );
        console.log(uploadResult)
        
        // // Clean up uploaded file
        // await fs.unlink(req.file.path).catch(() => {});
        
        // // Return info for publisher to register on-chain
        // res.json({
        //     success: true,
        //     rootHash: uploadResult.rootHash,
        //     totalChunks: uploadResult.totalChunks,
        //     storageTx: uploadResult.tx,
        //     instruction: 'Call publishDataset() from your wallet with these parameters',
        //     contractAddress: process.env.CONTRACT_ADDRESS,
        //     params: {
        //         rootHash: uploadResult.rootHash,
        //         metadataURI: metadata,
        //         pricePerChunk: ethers.parseEther(pricePerChunk.toString()).toString(),
        //         totalChunks: uploadResult.totalChunks
        //     }
        // });
    } catch (error) {
        console.error('Publish error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Main query endpoint with x402 payment
app.post('/api/ask', async (req, res) => {
    try {
        const { query, datasetHash, userAddress } = req.body;
        
        if (!query || !datasetHash || !userAddress) {
            return res.status(400).json({ 
                error: 'Missing required fields: query, datasetHash, userAddress' 
            });
        }
        
        // Process query through RAG service
        const result = await rag.processQuery(query, datasetHash, userAddress);
        
        // Set headers if payment required
        if (result.status === 402 && result.headers) {
            Object.keys(result.headers).forEach(key => {
                res.set(key, result.headers[key]);
            });
        }
        
        res.status(result.status).json(result.body);
    } catch (error) {
        console.error('Query error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user balance
app.get('/api/balance/:address', async (req, res) => {
    try {
        const balance = await contract.getUserBalance(req.params.address);
        res.json({
            address: req.params.address,
            balance: ethers.formatEther(balance),
            balanceWei: balance.toString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get dataset info
app.get('/api/dataset/:hash', async (req, res) => {
    try {
        const info = await contract.getDatasetInfo(req.params.hash);
        res.json({
            publisher: info.publisher,
            metadata: info.metadataURI,
            pricePerChunk: ethers.formatEther(info.pricePerChunk),
            totalChunks: info.totalChunks.toString(),
            active: info.active,
            rootHash: req.params.hash
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get proof details
app.get('/api/proof/:id', async (req, res) => {
    try {
        const proof = await contract.getProof(req.params.id);
        res.json({
            proofId: req.params.id,
            answerHash: proof.answerHash,
            datasetHash: proof.datasetHash,
            chunkIds: proof.chunkIds.map(id => id.toString()),
            user: proof.user,
            timestamp: proof.timestamp.toString(),
            amountPaid: ethers.formatEther(proof.amountPaid),
            modelUsed: proof.modelUsed
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List all datasets (helper endpoint)
app.get('/api/datasets', async (req, res) => {
    try {
        // Get from storage service cache
        const datasets = Array.from(storage.datasets.entries()).map(([hash, data]) => ({
            rootHash: hash,
            metadata: data.metadata,
            totalChunks: data.chunks?.length || 0,
            cached: true
        }));
        res.json(datasets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get server info
app.get('/api/info', async (req, res) => {
    try {
        const isAuthorized = await contract.isAuthorized();
        const balance = await contract.provider.getBalance(contract.wallet.address);
        
        res.json({
            serverWallet: contract.wallet.address,
            authorized: isAuthorized,
            serverBalance: ethers.formatEther(balance),
            contractAddress: process.env.CONTRACT_ADDRESS,
            network: '0G Testnet',
            services: {
                storage: '0G Storage',
                compute: '0G AI Compute', 
                chain: '0G Chain'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

export default app;