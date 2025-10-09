// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ProofRegistry {
    struct DatasetInfo {
        address publisher;
        string metadataURI;
        uint256 pricePerChunk;
        bytes32 rootHash;
        uint256 totalChunks;
        bool active;
    }
    
    struct QueryProof {
        bytes32 answerHash;
        bytes32 datasetHash;
        uint256[] chunkIds;
        address user;
        uint256 timestamp;
        uint256 amountPaid;
        string modelUsed;
    }
    
    mapping(bytes32 => DatasetInfo) public datasets;
    mapping(uint256 => QueryProof) public proofs;
    mapping(address => uint256) public userBalances;
    mapping(address => bool) public authorizedServices;
    
    uint256 public proofCounter;
    address public owner;
    
    event DatasetPublished(bytes32 indexed rootHash, address indexed publisher, uint256 pricePerChunk);
    event QueryProcessed(uint256 indexed proofId, address indexed user, bytes32 answerHash);
    event PaymentReceived(address indexed user, uint256 amount);
    event ChunksAccessed(bytes32 indexed datasetHash, uint256[] chunkIds, address indexed user);
    
    modifier onlyAuthorized() {
        require(authorizedServices[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        authorizedServices[msg.sender] = true;
    }
    
    function publishDataset(
        bytes32 _rootHash, 
        string memory _metadataURI, 
        uint256 _pricePerChunk,
        uint256 _totalChunks
    ) external {
        require(_pricePerChunk > 0, "Price must be > 0");
        require(_totalChunks > 0, "Must have chunks");
        
        datasets[_rootHash] = DatasetInfo({
            publisher: msg.sender,
            metadataURI: _metadataURI,
            pricePerChunk: _pricePerChunk,
            rootHash: _rootHash,
            totalChunks: _totalChunks,
            active: true
        });
        
        emit DatasetPublished(_rootHash, msg.sender, _pricePerChunk);
    }
    
    function deposit() external payable {
        require(msg.value > 0, "Must deposit something");
        userBalances[msg.sender] += msg.value;
        emit PaymentReceived(msg.sender, msg.value);
    }
    
    function recordProof(
        bytes32 _answerHash,
        bytes32 _datasetHash,
        uint256[] memory _chunkIds,
        address _user,
        string memory _modelUsed
    ) external onlyAuthorized returns (uint256) {
        DatasetInfo memory dataset = datasets[_datasetHash];
        require(dataset.active, "Dataset not active");
        
        uint256 cost = _chunkIds.length * dataset.pricePerChunk;
        require(userBalances[_user] >= cost, "Insufficient balance");
        
        userBalances[_user] -= cost;
        userBalances[dataset.publisher] += cost;
        
        proofCounter++;
        proofs[proofCounter] = QueryProof({
            answerHash: _answerHash,
            datasetHash: _datasetHash,
            chunkIds: _chunkIds,
            user: _user,
            timestamp: block.timestamp,
            amountPaid: cost,
            modelUsed: _modelUsed
        });
        
        emit QueryProcessed(proofCounter, _user, _answerHash);
        emit ChunksAccessed(_datasetHash, _chunkIds, _user);
        
        return proofCounter;
    }
    
    function withdraw() external {
        uint256 balance = userBalances[msg.sender];
        require(balance > 0, "No balance");
        userBalances[msg.sender] = 0;
        payable(msg.sender).transfer(balance);
    }
    
    function authorizeService(address _service) external {
        require(msg.sender == owner, "Only owner");
        authorizedServices[_service] = true;
    }
    
    function getDatasetInfo(bytes32 _rootHash) external view returns (DatasetInfo memory) {
        return datasets[_rootHash];
    }
    
    function getUserBalance(address _user) external view returns (uint256) {
        return userBalances[_user];
    }
}