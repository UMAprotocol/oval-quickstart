import MevShareClient, { BundleParams } from "@flashbots/mev-share-client";
import { JsonRpcProvider, Wallet } from "ethers";
import dotenv from "dotenv";
dotenv.config({
    path: "../.env"
});

export function getProvider(chainId: string) {
    return new JsonRpcProvider(process.env[`NODE_URL_${chainId}`]);
}

export function getMevShareClient(chainId: number, authSigner: Wallet) {
    return MevShareClient.fromNetwork(authSigner, { chainId: chainId })
}

async function main() {

    // Set up the mev-share client
    const chainId = process.env.CHAIN_ID;
    if (!chainId) throw new Error("CHAIN_ID not set");

    const provider = getProvider(chainId);

    const authPrivateKey = process.env["AUTH_PRIVATE_KEY"];
    if (!authPrivateKey) throw new Error("AUTH_PRIVATE_KEY not set");

    const authSigner = new Wallet(authPrivateKey).connect(provider);

    const mevShareClient = getMevShareClient(Number(chainId), authSigner)

    // Set up the bundle parameters
    const toAddress = authSigner.address; // to myself
    const amount = 1; // 1 wei

    const tx = {
        to: toAddress,
        value: amount
    };

    const signedTx = await authSigner.signTransaction(tx);

    const targetBlock = await provider.getBlockNumber() + 1;

    const BLOCK_RANGE_SIZE = 10;

    const bundle = [
        { tx: signedTx, canRevert: false },
    ]

    const params: BundleParams = {
        inclusion: {
            block: targetBlock,
            maxBlock: targetBlock + BLOCK_RANGE_SIZE,
        },
        body: bundle,
    }

    const bundleResult = await mevShareClient.sendBundle(params)

    console.log("Bundle result: ", bundleResult);
}

main();

