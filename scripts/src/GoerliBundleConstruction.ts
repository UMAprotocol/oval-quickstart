import MevShareClient, { BundleParams, HintPreferences, IPendingBundle } from "@reinis_frp/mev-share-client";
import dotenv from "dotenv";
import { JsonRpcProvider, Provider, Signer, Transaction, Wallet, ethers, keccak256 } from "ethers";
import { ChainlinkOvalImmutable, ChainlinkOvalImmutable__factory, OvalLiquidationDemoPriceFeed, OvalLiquidationDemoPriceFeed__factory, OvalLiquidationDemo__factory, PayBuilder__factory } from "../contract-types";

dotenv.config();

function getProvider(chainId: string) {
  return new JsonRpcProvider(process.env[`NODE_URL_${chainId}`]);
}

async function getBaseFee(provider: Provider) {
  const block = await provider.getBlock("latest");
  const baseFee = block?.baseFeePerGas;
  if (!baseFee) {
    throw new Error(`Block did not contain base fee. Is this running on an EIP-1559 network?`);
  }
  return baseFee;
}

const resetPriceFeed = async (demoPriceFeed: OvalLiquidationDemoPriceFeed, oval: ChainlinkOvalImmutable) => {
  const collateralInitialPrice = ethers.parseUnits("100", 8);
  const newRoundId = 1;
  const updateTime = Math.floor(new Date().getTime() / 1000);
  console.log("Updating price feed with roundId: ", newRoundId, " price: ", ethers.formatUnits(collateralInitialPrice, 8), " updateTime: ", updateTime);
  await (await demoPriceFeed.setValues(collateralInitialPrice, newRoundId, updateTime, updateTime, newRoundId)).wait();
  await (await oval.unlockLatestValue()).wait();
}

const getOvalPriceUpdateSignedTx = async (demoPriceFeed: OvalLiquidationDemoPriceFeed, signer: Signer, nonce: number, baseFee: bigint) => {
  const newRoundId = 2;
  const newCollateralPrice = ethers.parseUnits("90", 8); // 10% drop in price from initial price
  const newUpdateTime = Math.floor(new Date().getTime() / 1000);
  console.log("Updating price feed with roundId: ", newRoundId, " price: ", ethers.formatUnits(newCollateralPrice, 8), " updateTime: ", newUpdateTime);
  const callData = await demoPriceFeed.interface.encodeFunctionData("setValues", [newCollateralPrice, newRoundId, newUpdateTime, newUpdateTime, newRoundId]);

  return await signer.signTransaction({
    to: process.env["OVAL_LIQUIDATION_DEMO_PRICE_FEED_ADDRESS"],
    from: await signer.getAddress(),
    type: 2,
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0,
    gasLimit: 200000,
    nonce: nonce,
    value: 0,
    data: callData,
    chainId: process.env.CHAIN_ID
  });
}

const getUnlockBundle = async (oval: ChainlinkOvalImmutable, refundAddress: string, signer: Signer, nonce: number, currentBlock: number, baseFee: bigint) => {
  // Transaction to unlockLatestValue on Oval Oracle from permissioned address
  // In prod this would be sent by UMA or the Protocol running Oval Node, searchers don't need to send this (and can't)
  const unlockTx = {
    type: 2,
    to: process.env["CHAINLINK_OVAL_IMMUTABLE_ADDRESS"],
    nonce: nonce,
    value: 0,
    gasLimit: 200000,
    data: oval.interface.encodeFunctionData("unlockLatestValue"),
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0,
    chainId: process.env.CHAIN_ID
  };

  return {
    inclusion: { block: currentBlock, maxBlock: currentBlock + 25 },
    body: [
      { tx: await signer.signTransaction(unlockTx), canRevert: false },
    ],
    validity: {
      refundConfig: [
        {
          address: refundAddress,
          percent: 100,
        },
      ],
    },
    privacy: {
      hints: {
        calldata: true,
        logs: true,
        contractAddress: true,
        functionSelector: true,
        txHash: true,
      }
    },
  };
}

async function main() {
  // Set up the mev-share client
  const chainId = process.env.CHAIN_ID;
  if (!chainId) throw new Error("CHAIN_ID not set");

  // Environment variables
  const OVAL_LIQUIDATION_DEMO_PRICE_FEED_ADDRESS = process.env["OVAL_LIQUIDATION_DEMO_PRICE_FEED_ADDRESS"];
  if (!OVAL_LIQUIDATION_DEMO_PRICE_FEED_ADDRESS) throw new Error("OVAL_LIQUIDATION_DEMO_PRICE_FEED_ADDRESS not set");
  const CHAINLINK_OVAL_IMMUTABLE_ADDRESS = process.env["CHAINLINK_OVAL_IMMUTABLE_ADDRESS"];
  if (!CHAINLINK_OVAL_IMMUTABLE_ADDRESS) throw new Error("CHAINLINK_OVAL_IMMUTABLE_ADDRESS not set");
  const OVAL_LIQUIDATION_DEMO_ADDRESS = process.env["OVAL_LIQUIDATION_DEMO_ADDRESS"];
  if (!OVAL_LIQUIDATION_DEMO_ADDRESS) throw new Error("OVAL_LIQUIDATION_DEMO_ADDRESS not set");
  const PAY_BUILDER_ADDRESS = process.env["PAY_BUILDER_ADDRESS"];
  if (!PAY_BUILDER_ADDRESS) throw new Error("PAY_BUILDER_ADDRESS not set");
  const authPrivateKey = process.env["PRIVATE_KEY"];
  if (!authPrivateKey) throw new Error("PRIVATE_KEY not set");


  const provider = getProvider(chainId);

  // Define the signers for the demo, in prod these would be different
  const authSigner = new Wallet(authPrivateKey).connect(provider);
  const priceOracleSigner = authSigner;
  const user = authSigner
  const searcher = authSigner;
  const ovalSigner = authSigner;

  const mevShareClient = MevShareClient.fromNetwork(authSigner as any, { chainId: Number(chainId) })

  const demoPriceFeed = await OvalLiquidationDemoPriceFeed__factory.connect(OVAL_LIQUIDATION_DEMO_PRICE_FEED_ADDRESS, authSigner);
  const oval = await ChainlinkOvalImmutable__factory.connect(CHAINLINK_OVAL_IMMUTABLE_ADDRESS, authSigner);
  const liquidationDemo = await OvalLiquidationDemo__factory.connect(OVAL_LIQUIDATION_DEMO_ADDRESS, authSigner);
  const payBuilder = await PayBuilder__factory.connect(PAY_BUILDER_ADDRESS, authSigner);

  // Clear previous price feed values so we start with a price of 100
  await resetPriceFeed(demoPriceFeed, oval);

  // 1. A user creates a collateralized position in an example money market
  const collateralAmount = ethers.parseEther("0.01");
  await (await liquidationDemo.connect(user).updateCollateralisedPosition({ value: collateralAmount })).wait();
  console.log("User created as position in liquidation demo contract with ETH: ", ethers.formatEther(collateralAmount));

  // 2. The price feed in OvalLiquidationDemo is updated, rendering the user's position undercollateralized and eligible
  // for liquidation
  const nonce = await authSigner.getNonce();
  const baseFee = await getBaseFee(provider);
  // In prod, this would be sent by Chainlink oracle and found in the public mempool by the searcher
  const signedUpdatePriceFeed = await getOvalPriceUpdateSignedTx(demoPriceFeed, priceOracleSigner, nonce + 1, baseFee);

  // 3. A Searcher identifies this opportunity and submits a bundle to liquidate the user
  // When submitting the liquidation bundle to the Oval Node, a price unlock bundle is added in front. For this 
  // demonstration, the searcher's bundle already includes this price unlock bundle, but this will not be the case in 
  // a production environment. The price unlock bundle contains refund instructions to compensate the protocol with a 
  // portion of the winning auction bid.
  // 3.1 Oval unlockLatestValue bundle
  const refundAddress = await authSigner.getAddress();
  const currentBlock = await provider.getBlockNumber();
  const ovalUnlockLatestValueBundle = await getUnlockBundle(oval, refundAddress, ovalSigner, nonce, currentBlock, baseFee);

  // 3.2 Searcher finds the liquidation and sends a bundle to liquidate the position
  // 3.2.1 Transaction to liquidate the position
  const liquidateTransaction = {
    to: OVAL_LIQUIDATION_DEMO_ADDRESS,
    type: 2,
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0,
    gasLimit: 200000,
    nonce: nonce + 2,
    value: 0,
    data: liquidationDemo.interface.encodeFunctionData("liquidate", [authSigner.address]),
    chainId: chainId
  };


  // 3.2.2 Transaction to pay the builder
  // The Searcher is required to include a payment to the builder within the bundle, representing their bid in the Order
  // Flow Auction occurring in MEV Share. This is a standard practice.
  const liquidationValue = await liquidationDemo.ethBalances(authSigner.address);
  const blockBuilderPaymentTransaction = {
    to: PAY_BUILDER_ADDRESS,
    type: 2,
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0,
    nonce: nonce + 3,
    gasLimit: 200000,
    value: (liquidationValue * 90n) / 100n, // 90% of the value of the liquidation is sent to the builder
    data: payBuilder.interface.encodeFunctionData("payBuilder"),
    chainId: chainId,
  };

  const seacherBackrunBundleBody = [
    { bundle: ovalUnlockLatestValueBundle }, // In prod, this would be added by the Oval Node
    { tx: signedUpdatePriceFeed, canRevert: false },
    { tx: await searcher.signTransaction(liquidateTransaction), canRevert: false },
    { tx: await searcher.signTransaction(blockBuilderPaymentTransaction), canRevert: false },
  ]

  // Refund 90% of the winning bid to the protocol. In prod, this is configured in the Oval Node.
  const protocolRefundPercentage = 90;
  const searcherBundle: BundleParams = {
    inclusion: { block: currentBlock, maxBlock: currentBlock + 25 },
    body: seacherBackrunBundleBody,
    validity: {
      refund: [
        { bodyIdx: 0, percent: protocolRefundPercentage }
      ]
    },
    privacy: {
      hints: {
        calldata: true,
        logs: true,
        contractAddress: true,
        functionSelector: true,
        txHash: true,
      },
    },
  };

  const searcherReturn = liquidationValue - blockBuilderPaymentTransaction.value;
  const builderReturn = (blockBuilderPaymentTransaction.value * (100n - BigInt(protocolRefundPercentage))) / 100n;
  const protocolReturn = blockBuilderPaymentTransaction.value - builderReturn;

  console.log("Liquidation found!");
  console.log("Liquidation size eth: ", ethers.formatEther(liquidationValue), " eth");
  console.log("Searcher return: ", ethers.formatEther(searcherReturn), " eth");
  console.log("Builder return: ", ethers.formatEther(builderReturn), " eth");
  console.log("Protocol return: ~", ethers.formatEther(protocolReturn), " eth");

  // Bundle simulation
  const res = await mevShareClient.simulateBundle(searcherBundle)
  if (res.error) {
    console.log("Error: ", res.error)
    return
  }

  // Listen for our bundle to log the hash
  let bundleHash: string | undefined;
  let bundle: IPendingBundle | undefined;
  const bundleHandler = mevShareClient.on("bundle", async (tx: IPendingBundle) => {
    if (tx.hash === bundleHash) {
      bundle = tx;
    }
  });

  const result = await mevShareClient.sendBundle(searcherBundle)
  bundleHash = keccak256(result.bundleHash);

  // Logs
  // Wait for the bundle to be found
  while (!bundle) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Stop listening for bundles
  bundleHandler.close();
  console.log("Liquidation bundle sent with hash: ", bundle.hash);

  for (const tx of bundle.txs || []) {
    provider.waitForTransaction((tx as any).hash).then((receipt) => {
      const isPriceUnlock = receipt?.to === CHAINLINK_OVAL_IMMUTABLE_ADDRESS;
      const isPriceUpdate = receipt?.to === OVAL_LIQUIDATION_DEMO_PRICE_FEED_ADDRESS;
      const isLiquidate = receipt?.to === OVAL_LIQUIDATION_DEMO_ADDRESS;
      const isPayBuilder = receipt?.to === PAY_BUILDER_ADDRESS;
      console.log(`\n${isPriceUnlock ? "Price unlock" : isLiquidate ? "Liquidate" : isPayBuilder ? "Pay builder" : isPriceUpdate ? "Price feed update" : "Unknown"} tx mined!`);
      console.log(`Tx hash: ${receipt?.hash}`);
    }
    ).catch((err) => {
      console.log("Tx error: ", err);
    });
  }
}

main();