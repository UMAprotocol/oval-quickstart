import MevShareClient, { BundleParams, HintPreferences, IPendingBundle } from "@reinis_frp/mev-share-client";
import dotenv from "dotenv";
import { JsonRpcProvider, Provider, Transaction, Wallet, ethers, keccak256 } from "ethers";
import { ChainlinkOvalImmutable__factory, OvalLiquidationDemoPriceFeed__factory, OvalLiquidationDemo__factory, PayBuilder__factory } from "../contract-types";

dotenv.config();

export function getProvider(chainId: string) {
  return new JsonRpcProvider(process.env[`NODE_URL_${chainId}`]);
}

export function getMevShareClient(chainId: number, authSigner: any) {
  return MevShareClient.fromNetwork(authSigner, { chainId: chainId })
}

export interface ExtendedBundleParams extends BundleParams {
  privacy?: {
    hints?: HintPreferences,
    builders?: Array<string>,
    wantRefund?: number, // Optional property to set total refund percent.
  }
}

export async function getBaseFee(provider: Provider) {
  const block = await provider.getBlock("latest");
  const baseFee = block?.baseFeePerGas;
  if (!baseFee) {
    throw new Error(`Block did not contain base fee. Is this running on an EIP-1559 network?`);
  }
  return baseFee;
}

async function main() {
  // Set up the mev-share client
  const chainId = process.env.CHAIN_ID;
  if (!chainId) throw new Error("CHAIN_ID not set");

  const DEMO_PRICE_FEED_ADDRESS = process.env["DEMO_PRICE_FEED_ADDRESS"];
  if (!DEMO_PRICE_FEED_ADDRESS) throw new Error("DEMO_PRICE_FEED_ADDRESS not set");
  const OVAL_ADDRESS = process.env["OVAL_ADDRESS"];
  if (!OVAL_ADDRESS) throw new Error("OVAL_ADDRESS not set");
  const LIQUIDATION_DEMO_ADDRESS = process.env["LIQUIDATION_DEMO_ADDRESS"];
  if (!LIQUIDATION_DEMO_ADDRESS) throw new Error("LIQUIDATION_DEMO_ADDRESS not set");
  const PAY_BUILDER_ADDRESS = process.env["PAY_BUILDER_ADDRESS"];
  if (!PAY_BUILDER_ADDRESS) throw new Error("PAY_BUILDER_ADDRESS not set");

  const provider = getProvider(chainId);

  const authPrivateKey = process.env["PRIVATE_KEY"];
  if (!authPrivateKey) throw new Error("PRIVATE_KEY not set");

  const authSigner = new Wallet(authPrivateKey).connect(provider);

  const mevShareClient = MevShareClient.fromNetwork(authSigner as any, { chainId: Number(chainId) })

  const demoPriceFeed = await OvalLiquidationDemoPriceFeed__factory.connect(DEMO_PRICE_FEED_ADDRESS, authSigner);
  const oval = await ChainlinkOvalImmutable__factory.connect(OVAL_ADDRESS, authSigner);
  const liquidationDemo = await OvalLiquidationDemo__factory.connect(LIQUIDATION_DEMO_ADDRESS, authSigner);
  const payBuilder = await PayBuilder__factory.connect(PAY_BUILDER_ADDRESS, authSigner);

  let currentBlock = await provider.getBlockNumber();

  // Push a new chainlink price update
  const collateralInitialPrice = ethers.parseUnits("100", 8);
  let newRoundId = 1;
  const updateTime = Math.floor(new Date().getTime() / 1000);
  console.log("Updating price feed with roundId: ", newRoundId, " price: ", ethers.formatUnits(collateralInitialPrice, 8), " updateTime: ", updateTime);
  await (await demoPriceFeed.setValues(collateralInitialPrice, newRoundId, updateTime, updateTime, newRoundId)).wait();
  await (await oval.unlockLatestValue()).wait();

  // Create a position in the liquidation demo contract using the price above
  const collateralAmount = ethers.parseEther("0.01");
  console.log("Creating position in liquidation demo contract with ETH: ", ethers.formatEther(collateralAmount));
  await (await liquidationDemo.updateCollateralisedPosition({ value: collateralAmount })).wait();

  // Simulate a chainlink price update making the position undercollateralised
  currentBlock = await provider.getBlockNumber();
  newRoundId += 1;
  const newCollateralPrice = ethers.parseUnits("90", 8); // 10% drop in price from initial price
  const newUpdateTime = Math.floor(new Date().getTime() / 1000);
  console.log("Updating price feed with roundId: ", newRoundId, " price: ", ethers.formatUnits(newCollateralPrice, 8), " updateTime: ", updateTime);
  await (await demoPriceFeed.setValues(newCollateralPrice, newRoundId, newUpdateTime, newUpdateTime, newRoundId)).wait();

  // Liquidation
  currentBlock = await provider.getBlockNumber();
  const nonce = await authSigner.getNonce();
  const baseFee = await getBaseFee(provider);

  // Transaction to unlockLatestValue on Oval Oracle from permissioned address
  // In prod this would be sent by UMA or the Protocol running Oval-RPC, searchers don't need to send this (and can't)
  const unlockTx = {
    type: 2,
    to: OVAL_ADDRESS,
    nonce,
    value: 0,
    gasLimit: 200000,
    data: oval.interface.encodeFunctionData("unlockLatestValue"),
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0,
    chainId: chainId
  };

  // Transaction to liquidate the position
  const liquidateTransaction = {
    to: LIQUIDATION_DEMO_ADDRESS,
    type: 2,
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0,
    gasLimit: 200000,
    nonce: nonce + 1,
    value: 0,
    data: liquidationDemo.interface.encodeFunctionData("liquidate", [authSigner.address]),
    chainId: chainId
  };

  const liquidationValue = await liquidationDemo.ethBalances(authSigner.address);
  // Transaction to pay the builder
  const blockBuilderPaymentTransaction = {
    to: PAY_BUILDER_ADDRESS,
    type: 2,
    maxFeePerGas: baseFee * 2n,
    maxPriorityFeePerGas: 0,
    nonce: nonce + 2,
    gasLimit: 200000,
    value: (liquidationValue * 90n) / 100n, // 90% of the value of the liquidation is sent to the builder
    data: payBuilder.interface.encodeFunctionData("payBuilder"),
    chainId: chainId,
  };

  const innerBundleBody = [
    { tx: await authSigner.signTransaction(unlockTx), canRevert: false },
  ]

  const innerBundle: ExtendedBundleParams = {
    inclusion: { block: currentBlock, maxBlock: currentBlock + 25 },
    body: innerBundleBody,
    validity: {
      refundConfig: [
        {
          address: await authSigner.getAddress(),
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

  const outterBundleBody = [
    { bundle: innerBundle },
    { tx: await authSigner.signTransaction(liquidateTransaction), canRevert: true },
    { tx: await authSigner.signTransaction(blockBuilderPaymentTransaction), canRevert: true },
  ]

  const protocolRefundPercentage = 90;

  const outterBundle: BundleParams = {
    inclusion: { block: currentBlock, maxBlock: currentBlock + 25 },
    body: outterBundleBody,
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

  const res = await mevShareClient.simulateBundle(outterBundle)

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

  const result = await mevShareClient.sendBundle(outterBundle)
  bundleHash = keccak256(result.bundleHash);

  // Wait for the bundle to be found
  while (!bundle) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Stop listening for bundles
  bundleHandler.close();
  console.log("Liquidation bundle sent with hash: ", bundle.hash);

  for (const tx of bundle.txs || []) {
    provider.waitForTransaction((tx as any).hash).then((receipt) => {
      const isPriceUnlock = receipt?.to === OVAL_ADDRESS;
      const isLiquidate = receipt?.to === LIQUIDATION_DEMO_ADDRESS;
      const isPayBuilder = receipt?.to === PAY_BUILDER_ADDRESS;
      console.log(`\n${isPriceUnlock ? "Price unlock" : isLiquidate ? "Liquidate" : isPayBuilder ? "Pay builder" : "Unknown"} tx mined!`);
      console.log(`Tx hash: ${receipt?.hash}`);
    }
    ).catch((err) => {
      console.log("Tx error: ", err);
    });
  }
}

main();