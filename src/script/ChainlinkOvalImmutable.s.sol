// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";
import {ChainlinkOvalImmutable} from "../ChainlinkOvalImmutable.sol";
import {IAggregatorV3Source} from "oval/src/interfaces/chainlink/IAggregatorV3Source.sol";

contract ChainlinkOvalImmutableScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address chainlink = vm.envAddress("SOURCE_ADDRESS");
        uint256 lockWindow = vm.envUint("LOCK_WINDOW");
        uint256 maxTraversal = vm.envUint("MAX_TRAVERSAL");

        // This script assumes exactly one unlocker is set. If you want to set more than one, you'll need to modify this
        // script to have an array of known unlocker addresses.
        address unlocker = vm.envAddress("UNLOCKER");
        address[] memory unlockers = new address[](1);
        unlockers[0] = unlocker;

        IAggregatorV3Source source = IAggregatorV3Source(chainlink);
        uint8 decimals = IAggregatorV3Source(chainlink).decimals();
        vm.startBroadcast(deployerPrivateKey);

        ChainlinkOvalImmutable oracle =
            new ChainlinkOvalImmutable(source, decimals, lockWindow, maxTraversal, unlockers);

        console.log("Deployed ChainlinkOvalImmutable contract at address: ", address(oracle));

        vm.stopBroadcast();
    }
}
