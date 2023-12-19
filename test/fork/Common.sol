// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.17;

import {Test} from "forge-std/Test.sol";

contract CommonTest is Test {
    address public constant permissionedUnlocker = address(0x2);
    address public constant liquidator = address(0x3);
}
