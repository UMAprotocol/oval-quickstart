// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// This contract is a mainnet fork test to showcase how Oval can be added to Aave v3 and a demonstrate sample Aave
// liquidation before and after adding Oval. The tests work by forking mainnet right before a historic Chainlink update
// on the ETH/USD that created a mainnet liquidation. The Aave chainlink oracle is replaced with a configured Oval
//instance, to mimic what an Oval Aave integration would look like. The tests then show that only once the
// unlocklatestValue function is called can the liquidation be executed. When run on mainnet and in conjuction with
// mev-share this would only be possible if the liquidator was the winner of the mev-share auction.

import {CommonTest} from "./Common.sol";

import {ChainlinkOvalImmutable} from "../../src/ChainlinkOvalImmutable.sol"; // The sample Oval instance to use.

// Required chainlink & Aave interfaces.
import {ILendingPool} from "oval/test/fork/interfaces/aave/ILendingPool.sol";
import {IAaveOracle} from "oval/test/fork/interfaces/aave/IAaveOracle.sol";
import {IAggregatorV3Source} from "oval/src/interfaces/chainlink/IAggregatorV3Source.sol";
import {IERC20} from "openzeppelin-contracts/contracts/interfaces/IERC20.sol";

contract Aave3LiquidationTest is CommonTest {
    // These tests execute against known Aave contracts, with USDC as debt and WETH as margin.
    uint256 amountToMintToLiquidator = 10000e6;
    ILendingPool lendingPool = ILendingPool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);
    Usdc usdcDebtAsset = Usdc(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48); // USDC
    IERC20 collateralAsset = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // WETH
    address user = 0xb8618D9D13e2BAA299bb726b413fF66418efbBD0; // The account liquidated.
    IAggregatorV3Source sourceChainlinkOracle = IAggregatorV3Source(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    IAaveOracle aaveOracle = IAaveOracle(0x54586bE62E3c3580375aE3723C145253060Ca0C2); // Aave v3 oracle

    // Chainlink was updated in the block below. The tx hash is the transaction right after the oracle is updated and is
    // the tx in which the liquidation occurred on mainnet. This is the Liquidation we will be replaying in the tests.
    // If we want to back run the oracle we want to replace this transaction with our actions in the tests.
    uint256 oracleUpdateBlock = 18018927;
    bytes32 liquidationTx = 0x33ada9fb50abfbf29b59647328bd5fff5121ec04ec43a64f1540de0c898dfd6f;

    ChainlinkOvalImmutable oval; // Instance of Oval that is set.

    function setUp() public {
        vm.createSelectFork("mainnet", oracleUpdateBlock - 1); // Rolling to the block before the oracle update to start off all tests.
    }

    // Show that before the Oracle update the position is healthy and after the update it is not. This creates the
    // conditions for the liquidation that follows in later tests.
    function testUserPositionHealth() public {
        // We start before applying the oracle update. At this location, the position should still be healthy.
        assertTrue(isPositionHealthy());

        assertTrue(block.number == oracleUpdateBlock - 1);
        vm.rollFork(liquidationTx); // Right after the oracle update the position should be underwater.
        assertTrue(block.number == oracleUpdateBlock);

        assertFalse(isPositionHealthy());
    }

    // Show that we can execute the liquidation within the fork. Roll to right after the oracle update and execute.
    // We should see the position get liquidated.
    function testCanExecuteStandardLiquidation() public {
        seedLiquidator();
        //Show that we can execute the liquidation within the fork. Roll to right after the oracle update and execute.
        vm.rollFork(liquidationTx);
        vm.prank(liquidator);
        lendingPool.liquidationCall(address(collateralAsset), address(usdcDebtAsset), user, type(uint256).max, false);

        assertTrue(usdcDebtAsset.balanceOf(liquidator) < amountToMintToLiquidator); // Some amount of USDC spent on the liquidation
        assertTrue(collateralAsset.balanceOf(liquidator) > 0); // Some amount of WETH received from the liquidation

        (,,,,, uint256 healthFactorAfter) = lendingPool.getUserAccountData(user);
        assertTrue(isPositionHealthy()); // Health factor should be greater than 1 after liquidation.
    }

    // Show that we can deploy an Oval contract and replace the Aave oracle with it. We should then be able to show that
    // Aave liquidations are blocked until Oval is unlocked, at which point the liquidation can be executed as usual.
    function testCanReplaceSourceAndExecuteLiquidation() public {
        seedLiquidator();
        createOvalAndUnlock(); // Deploy an Oval contract and update it.
        setOvalAsAaveSource(); // Update Aave to use Oval contract as the source oracle.
        updateChainlinkToLatestValue(); // Roll after the chainlink update. However, dont update Oval instance.

        // Even though the chainlink oracle is up to date, Oval is not. This means an attempted liquidation
        // will fail because Oval price is stale. Only once Oval is updated can the liquidation go through.
        vm.prank(liquidator);
        vm.expectRevert(bytes("45")); // 45 corresponds with position health being above 1.
        lendingPool.liquidationCall(address(collateralAsset), address(usdcDebtAsset), user, type(uint256).max, false);

        //Now, unlock Oval and show that the liquidation can be executed.
        vm.prank(permissionedUnlocker);
        oval.unlockLatestValue();
        (, int256 latestAnswer,, uint256 latestTimestamp,) = sourceChainlinkOracle.latestRoundData();
        assertTrue(oval.latestAnswer() == latestAnswer && oval.latestTimestamp() == latestTimestamp);
        assertTrue(aaveOracle.getAssetPrice(address(collateralAsset)) == uint256(oval.latestAnswer()));
        assertFalse(isPositionHealthy()); // Post update but pre-liquidation position should be underwater.

        vm.prank(liquidator); // Run the liquidation from the liquidator.
        lendingPool.liquidationCall(address(collateralAsset), address(usdcDebtAsset), user, type(uint256).max, false);
        assertTrue(isPositionHealthy()); // Post liquidation position should be healthy again.
    }

    // Show that we can gracefully fall back to the source oracle if Oval is not unlocked. This would be the case
    // if the permissioned actor went offline or MEV-share broke.
    function testOvalGracefullyFallsBackToSourceIfNoUnlockApplied() public {
        seedLiquidator();
        createOvalAndUnlock(); // Deploy an Oval contract and update it.
        setOvalAsAaveSource(); // Update Aave to use Oval contract as the source oracle.
        updateChainlinkToLatestValue(); // Roll after the chainlink update. However, dont update Oval instance.

        // Even though the chainlink oracle is up to date, Oval is not. This means an attempted liquidation
        // will fail because Oval price is stale. Only once Oval is updated can the liquidation go through.
        vm.prank(liquidator);
        vm.expectRevert(bytes("45")); // 45 corresponds with position health being above 1.
        lendingPool.liquidationCall(address(collateralAsset), address(usdcDebtAsset), user, type(uint256).max, false);

        // To show that we can gracefully fall back to the source oracle, we will not unlock Oval and
        // rather advance time past the lock window. This will cause Oval to fall back to the source
        // oracle and the liquidation will succeed without Oval being unlocked.
        vm.warp(block.timestamp + oval.lockWindow() + 1);

        // We should see the accessors return the same values, even though the internal values are different.
        (, int256 latestAnswer,, uint256 latestTimestamp,) = sourceChainlinkOracle.latestRoundData();
        assertTrue(oval.latestAnswer() == latestAnswer && oval.latestTimestamp() == latestTimestamp);
        assertFalse(isPositionHealthy()); // Post update but pre-liquidation position should be underwater.

        // Now, run the liquidation. It should succeed without Oval being unlocked due to the fallback.
        vm.prank(liquidator);
        lendingPool.liquidationCall(address(collateralAsset), address(usdcDebtAsset), user, type(uint256).max, false);
        assertTrue(isPositionHealthy()); // Post liquidation position should be healthy again.
    }
    /////////////
    // Helpers //
    /////////////

    function seedLiquidator() public {
        assertTrue(usdcDebtAsset.balanceOf(liquidator) == 0);
        vm.prank(0x5B6122C109B78C6755486966148C1D70a50A47D7); // Prank a known USDC Minter.
        usdcDebtAsset.mint(liquidator, amountToMintToLiquidator);
        assertTrue(usdcDebtAsset.balanceOf(liquidator) == amountToMintToLiquidator);
        assertTrue(collateralAsset.balanceOf(liquidator) == 0);

        vm.prank(liquidator);
        usdcDebtAsset.approve(address(lendingPool), amountToMintToLiquidator);
    }

    function createOvalAndUnlock() public {
        address[] memory unlockers = new address[](1);
        unlockers[0] = permissionedUnlocker;
        oval = new ChainlinkOvalImmutable(sourceChainlinkOracle, 8, 60, 4, unlockers);

        // Pull the latest price into Oval and check it matches with the source oracle.
        vm.prank(permissionedUnlocker);
        oval.unlockLatestValue();
        (, int256 latestAnswer,, uint256 latestTimestamp,) = sourceChainlinkOracle.latestRoundData();
        assertTrue(latestAnswer == oval.latestAnswer() && latestTimestamp == oval.latestTimestamp());
    }

    function setOvalAsAaveSource() public {
        // Set Oval as the source oracle for the WETH asset for Aave.
        address[] memory assets = new address[](1);
        assets[0] = address(collateralAsset);
        address[] memory sources = new address[](1);
        sources[0] = address(oval);
        vm.prank(0xEE56e2B3D491590B5b31738cC34d5232F378a8D5); // Prank ACLAdmin.
        aaveOracle.setAssetSources(assets, sources);
    }

    function updateChainlinkToLatestValue() public {
        // Apply the Chainlink update within Chainlink. This wont affect Oval price until it is unlocked.
        (, int256 answerBefore,, uint256 timestampBefore,) = sourceChainlinkOracle.latestRoundData();
        vm.rollFork(liquidationTx);
        (, int256 answerAfter,, uint256 timestampAfter,) = sourceChainlinkOracle.latestRoundData();

        // Values have changed in chainlink but is stale within Oval.
        assertTrue(answerBefore != answerAfter && timestampBefore != timestampAfter);
        assertTrue(oval.latestAnswer() == answerBefore && oval.latestTimestamp() == timestampBefore);
        assertTrue(oval.latestAnswer() != answerAfter && oval.latestTimestamp() != timestampAfter);
        // Aave oracle should match Oval, not the source oracle.
        (, int256 latestAnswer,,,) = sourceChainlinkOracle.latestRoundData();
        assertTrue(aaveOracle.getAssetPrice(address(collateralAsset)) == uint256(oval.latestAnswer()));
        assertTrue(aaveOracle.getAssetPrice(address(collateralAsset)) != uint256(latestAnswer));
    }

    function isPositionHealthy() public view returns (bool) {
        (,,,,, uint256 healthFactorAfter) = lendingPool.getUserAccountData(user);
        return healthFactorAfter > 1e18;
    }
}

interface Usdc is IERC20 {
    function mint(address _to, uint256 _amount) external returns (bool);
}
