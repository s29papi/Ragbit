import { Indexer, ZgFile } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();




async function testUpload() {
    console.log('Testing 0G Storage Upload...');

    // Network Constants
    const RPC_URL = 'https://evmrpc-testnet.0g.ai/';
    const INDEXER_RPC = 'https://indexer-storage-testnet-turbo.0g.ai';

    // Initialize provider and signer
    const privateKey = process.env.PRIVATE_KEY; // Replace with your private key
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(privateKey, provider);

    // Initialize indexer
    const indexer = new Indexer(INDEXER_RPC);

    const fs = await import('fs/promises');
    const testFilePath = './test.txt';
    const testContent = "This is a test dataset for RAGbits Exchange. It contains sample data.";

    try {
        // Check if file exists
        await fs.access(testFilePath);
        console.log('Test file already exists, using existing file');
    } catch (error) {
        // File doesn't exist, create it
        console.log('Creating test file...');
        await fs.writeFile(testFilePath, testContent);
        console.log('Test file created');
    }

    const {rootHash, txHash} = await uploadFile(indexer, testFilePath, RPC_URL, signer);
    console.log(rootHash)
    console.log(txHash)

    // what a successfullty uploaded file looks like.

    // Testing 0G Storage Upload...
    // Test file already exists, using existing file
    // File Root Hash: 0xac6d525fde1326853edbc40852d75f66aeed4d975bda013a07abfaeda0a2afef
    // First selected node status : {
    // connectedPeers: 6,
    // logSyncHeight: 398621,
    // logSyncBlock: '0x74d23bad70dcaae3ebf903b4df2e4a11d32a0fc457f151d9d1ca8834befaa34f',
    // nextTxSeq: 2542,
    // networkIdentity: {
    //     chainId: 16602,
    //     flowAddress: '0x22e03a6a89b950f1c82ec5e74f8eca321a105296',
    //     p2pProtocolVersion: { major: 0, minor: 4, build: 0 }
    // }
    // }
    // Selected nodes: [
    // StorageNode {
    //     url: 'http://34.55.197.204:5678',
    //     timeout: 30000,
    //     retry: 3
    // },
    // StorageNode {
    //     url: 'http://34.102.76.235:5678',
    //     timeout: 30000,
    //     retry: 3
    // }
    // ]
    // Data prepared to upload root=0xac6d525fde1326853edbc40852d75f66aeed4d975bda013a07abfaeda0a2afef size=69 numSegments=1 numChunks=1
    // Attempting to find existing file info by root hash...
    // Submitting transaction with storage fee: 30733644962n
    // Sending transaction with gas price 2000000007
    // Transaction hash: 0xba55606ce4bbd5c4862e0f1716fb2caa1065dc6d717be337d9630656311f5232
    // Transaction sequence number: 2543
    // Wait for log entry on storage node
    // Log entry is unavailable yet, zgsNodeSyncHeight=398638
    // Log entry is unavailable yet, zgsNodeSyncHeight=398638
    // File already exists on node http://34.55.197.204:5678 {
    // tx: {
    //     streamIds: [],
    //     data: [],
    //     dataMerkleRoot: '0xac6d525fde1326853edbc40852d75f66aeed4d975bda013a07abfaeda0a2afef',
    //     merkleNodes: [ [Array] ],
    //     startEntryIndex: 732336,
    //     size: 69,
    //     seq: 2543
    // },
    // finalized: true,
    // isCached: false,
    // uploadedSegNum: 1,
    // pruned: false
    // }
    // Tasks created: [
    // [
    //     {
    //     clientIndex: 1,
    //     taskSize: 10,
    //     segIndex: 0,
    //     numShard: 2,
    //     txSeq: 2543
    //     }
    // ]
    // ]
    // Processing tasks in parallel with  1  tasks...
    // null response error on attempt 1/3. Retrying in 3s...
    // Segments already uploaded and finalized on node http://34.102.76.235:5678
    // All tasks processed
    // Wait for log entry on storage node
    // Upload successful! Transaction: {
    // txHash: '0xba55606ce4bbd5c4862e0f1716fb2caa1065dc6d717be337d9630656311f5232',
    // rootHash: '0xac6d525fde1326853edbc40852d75f66aeed4d975bda013a07abfaeda0a2afef'
    // }
    // 0xac6d525fde1326853edbc40852d75f66aeed4d975bda013a07abfaeda0a2afef
    // {
    // txHash: '0xba55606ce4bbd5c4862e0f1716fb2caa1065dc6d717be337d9630656311f5232',
    // rootHash: '0xac6d525fde1326853edbc40852d75f66aeed4d975bda013a07abfaeda0a2afef'
    // }
  
}
testUpload();


async function uploadFile(indexer, filePath, RPC_URL, signer) {
  // Create file object from file path
  const file = await ZgFile.fromFilePath(filePath);
  
  // Generate Merkle tree for verification
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr !== null) {
    throw new Error(`Error generating Merkle tree: ${treeErr}`);
  }
  
  // Get root hash for future reference
  console.log("File Root Hash:", tree?.rootHash());
  
  // Upload to network
  const [tx, uploadErr] = await indexer.upload(file, RPC_URL, signer);
  if (uploadErr !== null) {
    throw new Error(`Upload error: ${uploadErr}`);
  }
  
  console.log("Upload successful! Transaction:", tx);
  
  // Always close the file when done
  await file.close();
  
  return { rootHash: tree?.rootHash(), txHash: tx };
}