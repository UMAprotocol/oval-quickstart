// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.17;

contract PayBuilder {
    event BuilderPaid(address sender, address builder, uint256 amount);

    function payBuilder() public payable {
        block.coinbase.transfer(msg.value);
        emit BuilderPaid(msg.sender, block.coinbase, msg.value);
    }
}
