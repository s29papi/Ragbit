// Handles all 0G Storage operations
import { Indexer, ZgFile } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import crypto from 'crypto';
import fs from 'fs/promises';

class StorageService {
    constructor(privateKey) {
        this.provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai/');
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.indexer = new Indexer('https://indexer-storage-testnet-standard.0g.ai');
        this.datasets = new Map(); // In-memory cache
    }

    async uploadDataset(filePath, metadata) {
        // Read file and create chunks
        const content = await fs.readFile(filePath, 'utf8');
        const chunks = this.createChunks(content);
        
        // Generate merkle tree
        const file = await ZgFile.fromFilePath(filePath);
        const [tree, treeErr] = await file.merkleTree();
        if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);
        
        const rootHash = tree.rootHash();
        ZgFile.

       
        
        // Upload to 0G Storage
        // const [tx, uploadErr] = await this.indexer.upload(
        //     file, 
        //     'https://evmrpc-testnet.0g.ai/',
        //     this.wallet
        // );
        // if (uploadErr) throw new Error(`Upload error: ${uploadErr}`);

        // Cache dataset
        this.datasets.set(rootHash, {
            metadata,
            chunks,
            rootHash,
            // uploadTx: tx
        });
        
        await file.close();
        
        return {
            rootHash,
            totalChunks: chunks.length,
            // tx
        };
    }

    createChunks(content) {
        const paragraphs = content.split('\n\n').filter(p => p.trim());
        return paragraphs.map((text, idx) => ({
            id: idx,
            text: text.trim(),
            hash: crypto.createHash('sha256').update(text).digest('hex')
        }));
    }

    async searchRelevantChunks(rootHash, query, maxChunks = 5) {
        const dataset = this.datasets.get(rootHash);
        if (!dataset) {
            // Download from 0G if not cached
            await this.downloadDataset(rootHash);
            dataset = this.datasets.get(rootHash);
        }
        
        // Simple keyword search
        const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        
        const scored = dataset.chunks.map(chunk => {
            const text = chunk.text.toLowerCase();
            const score = queryWords.filter(word => text.includes(word)).length;
            return { ...chunk, score };
        });
        
        return scored
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxChunks);
    }

    async downloadDataset(rootHash) {
        const tempPath = `./temp/${rootHash}.txt`;
        const err = await this.indexer.download(rootHash, tempPath, false);
        if (err) throw new Error(`Download failed: ${err}`);
        
        const content = await fs.readFile(tempPath, 'utf8');
        const chunks = this.createChunks(content);
        
        this.datasets.set(rootHash, { chunks, rootHash });
        await fs.unlink(tempPath).catch(() => {});
    }
}

export default StorageService;