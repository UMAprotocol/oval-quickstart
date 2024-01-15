// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

import "forge-std/Script.sol";

import {OvalLiquidationDemo} from "../OvalLiquidationDemo.sol";
import {OvalLiquidationDemoPriceFeed} from "../OvalLiquidationDemoPriceFeed.sol";
import {IAggregatorV3Source} from "oval/src/interfaces/chainlink/IAggregatorV3Source.sol";
import {ChainlinkOvalImmutable} from "../../ChainlinkOvalImmutable.sol";
import {PayBuilder} from "../OvalLiquidationDemoPayBuilder.sol";

contract OvalLiquidationDemoScript is Script {
    function run() external {
        uint256 lockWindow = 60;
        uint256 maxTraversal = 10;

        address[] memory unlockers = new address[](1);
        unlockers[0] = msg.sender;

        vm.startBroadcast();

        OvalLiquidationDemoPriceFeed cl = new OvalLiquidationDemoPriceFeed();

        console.log("Deployed OvalLiquidationDemoPriceFeed contract at address: ", address(cl));

        ChainlinkOvalImmutable oval = new ChainlinkOvalImmutable(
            cl,
            8,
            60, // lockWindow (seconds) ~ 5 blocks
            10, // maxTraversal
            unlockers
        );

        console.log("Deployed ChainlinkOvalImmutable contract at address: ", address(oval));

        OvalLiquidationDemo demo = new OvalLiquidationDemo(IAggregatorV3Source(address(oval)));

        console.log("Deployed OvalLiquidationDemo contract at address: ", address(demo));

        PayBuilder payBuilder = new PayBuilder();

        console.log("Deployed PayBuilder contract at address: ", address(payBuilder));

        vm.stopBroadcast();
    }
}
