// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.17;

import {BaseController} from "oval-contracts/controllers/BaseController.sol";
import {ChainlinkSourceAdapter} from "oval-contracts/adapters/source-adapters/ChainlinkSourceAdapter.sol";
import {ChainlinkDestinationAdapter} from "oval-contracts/adapters/destination-adapters/ChainlinkDestinationAdapter.sol";
import {IAggregatorV3Source} from "oval-contracts/interfaces/chainlink/IAggregatorV3Source.sol";

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
