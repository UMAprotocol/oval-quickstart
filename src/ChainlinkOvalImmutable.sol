// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.17;

import {ImmutableController} from "../controllers/ImmutableController.sol";
import {ChainlinkSourceAdapter} from "../adapters/source-adapters/ChainlinkSourceAdapter.sol";
import {ChainlinkDestinationAdapter} from "../adapters/destination-adapters/ChainlinkDestinationAdapter.sol";
import {IAggregatorV3Source} from "../interfaces/chainlink/IAggregatorV3Source.sol";

/**
 * @title OvalOracle instance that has input and output adapters of Chainlink and ImmutableController.
 */
contract ChainlinkOvalImmutable is ImmutableController, ChainlinkSourceAdapter, ChainlinkDestinationAdapter {
    constructor(
        IAggregatorV3Source source, // The input chainlink source
        uint8 decimals, // The number of decimals the input should provide.
        uint256 lockWindow, // How long the permissioned actor has after each update to run an OEV auction.
        uint256 maxTraversal, // The maximum lookback traversal limit when looking for historic data.
        address[] memory unlockers // A set of unlockers who can initiate OEV auctions.
    )
        ChainlinkSourceAdapter(source)
        ImmutableController(lockWindow, maxTraversal, unlockers)
        ChainlinkDestinationAdapter(decimals)
    {}
}
