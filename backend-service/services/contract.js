// Handles all smart contract interactions
import { ethers } from 'ethers';

class ContractService {
    constructor(contractAddress, contractABI, privateKey) {
        this.provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai/');
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.contract = new ethers.Contract(contractAddress, contractABI, this.wallet);
        this.address = contractAddress;
    }

    // Read functions (no gas needed)
    async getUserBalance(userAddress) {
        return await this.contract.userBalances(userAddress);
    }

    async getDatasetInfo(rootHash) {
        return await this.contract.getDatasetInfo(rootHash);
    }

    async getProof(proofId) {
        return await this.contract.proofs(proofId);
    }

    // Write function (needs authorization)
    async recordProof(answerHash, datasetHash, chunkIds, userAddress, modelUsed) {
        const tx = await this.contract.recordProof(
            answerHash,
            datasetHash,
            chunkIds,
            userAddress,
            modelUsed
        );
        const receipt = await tx.wait();
        
        // Extract proof ID from event
        const event = receipt.logs.find(log => 
            log.topics[0] === ethers.id("QueryProcessed(uint256,address,bytes32)")
        );
        const proofId = parseInt(event.topics[1], 16);
        
        return proofId;
    }

    // Helper to check if server is authorized
    async isAuthorized() {
        return await this.contract.authorizedServices(this.wallet.address);
    }
}

export default ContractService;