// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {IAggregatorV3Source} from "oval/src/interfaces/chainlink/IAggregatorV3Source.sol";
import {ChainlinkOvalImmutable} from "../ChainlinkOvalImmutable.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Address} from "openzeppelin-contracts/contracts/utils/Address.sol";

contract OvalLiquidationDemo is Ownable {
    mapping(address => uint256) public ethBalances; // Collateral balance in ETH
    mapping(address => uint256) public usdValues; // Collateral value in USD

    uint256 public ethKickedBack;

    IAggregatorV3Source public oval; // Oval Oracle instance looks like a Chainlink price feed

    constructor(IAggregatorV3Source _oval) {
        oval = _oval;
    }

    // Receive ETH from liquidations kick backs
    receive() external payable {
        ethKickedBack += msg.value;
    }

    // Owners can drain the ETH kicked back to the contract from liquidations
    function drain() external onlyOwner {
        uint256 toDrain = ethKickedBack;
        ethKickedBack = 0;
        Address.sendValue(payable(owner()), toDrain);
    }

    // Users create/update their collateralised positions by sending ETH to this function
    function updateCollateralisedPosition() external payable {
        ethBalances[msg.sender] += msg.value;
        usdValues[msg.sender] = getUserValue(msg.sender);
    }

    // If users value falls below their original value, they can be liquidated
    function liquidate(address _user) external {
        require(usdValues[_user] > getUserValue(_user), "OvalLiquidationDemo: user is not undercollateralised");
        uint256 amount = ethBalances[_user];
        ethBalances[_user] = 0;
        usdValues[_user] = 0;
        payable(msg.sender).transfer(amount);
    }

    function getUserValue(address _user) public view returns (uint256) {
        (, int256 answer,,,) = oval.latestRoundData();
        return (uint256(answer) * ethBalances[_user]) / 10 ** 18;
    }
}
