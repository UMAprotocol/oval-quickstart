// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {IAggregatorV3Source} from "oval/src/interfaces/chainlink/IAggregatorV3Source.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract OvalLiquidationDemoPriceFeed is IAggregatorV3Source, Ownable {
    int256 public answer;
    uint80 public roundId;
    uint256 public updatedAt;
    uint256 public startedAt;
    uint80 public answeredInRound;

    constructor() {
        answer = 100 * 10 ** 8; // 1 ETH = 100 USD (8 decimals)
        roundId = 1;
        updatedAt = block.timestamp;
        startedAt = block.timestamp;
        answeredInRound = 1;
    }

    function decimals() external view returns (uint8) {
        return 8;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }

    function getRoundData(uint80) external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }

    function setValues(int256 _answer, uint80 _roundId, uint256 _updatedAt, uint256 _startedAt, uint80 _answeredInRound)
        external
        onlyOwner
    {
        answer = _answer;
        roundId = _roundId;
        updatedAt = _updatedAt;
        startedAt = _startedAt;
        answeredInRound = _answeredInRound;
    }
}
