// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ProofRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Set proper gas price for 0G testnet
        vm.txGasPrice(2000000000); // 2 Gwei minimum
        
        vm.startBroadcast(deployerPrivateKey);
        
        ProofRegistry registry = new ProofRegistry();
        
        console.log("ProofRegistry deployed at:", address(registry));
        console.log("Chain ID:", block.chainid);
        console.log("Gas Price:", tx.gasprice);
        
        vm.stopBroadcast();
    }
}



