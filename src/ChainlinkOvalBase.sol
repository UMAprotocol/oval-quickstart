// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {BaseController} from "oval/src/controllers/BaseController.sol";
import {ChainlinkSourceAdapter} from "oval/src/adapters/source-adapters/ChainlinkSourceAdapter.sol";
import {ChainlinkDestinationAdapter} from "oval/src/adapters/destination-adapters/ChainlinkDestinationAdapter.sol";
import {IAggregatorV3Source} from "oval/src/interfaces/chainlink/IAggregatorV3Source.sol";

/**
 * @title OvalOracle instance that has input and output adapters of Chainlink and BaseController.
 */
contract ChainlinkOvalBase is BaseController, ChainlinkSourceAdapter, ChainlinkDestinationAdapter {
    constructor(IAggregatorV3Source source, uint8 decimals)
        BaseController()
        ChainlinkSourceAdapter(source)
        ChainlinkDestinationAdapter(decimals)
    {}
}
