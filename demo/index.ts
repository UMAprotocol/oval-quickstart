import MevShareClient, { BundleParams, IPendingBundle, IPendingTransaction, TransactionOptions } from "@flashbots/mev-share-client";
import { JsonRpcProvider, TransactionRequest, Wallet, ethers } from "ethers";
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

    const mevShareClient = MevShareClient.fromNetwork(authSigner, { chainId: Number(chainId) })


    let foundTx = false;
    const expectedTxTo = authSigner.address
    const txHandler = mevShareClient.on("transaction", async (tx: IPendingTransaction) => {
        if (tx && tx.to?.toLowerCase() == expectedTxTo.toLowerCase()) {
            // You can search by tx.hash in
            // https://mev-share-goerli.flashbots.net/
            // https://mev-share.flashbots.net/
            console.log("Transaction: ", tx);
            foundTx = true;
        }
    })

    const bundleHandler = mevShareClient.on("bundle", async (tx: IPendingBundle) => {
        const firstTx = tx.txs ? tx.txs[0] : undefined;
        if (firstTx && firstTx.to == "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D") {
            console.log("Bundle: ", tx);
        }
    })

    // Set up the bundle parameters
    const toAddress = authSigner.address; // to myself
    const amount = 1; // 1 wei

    const block = await provider.getBlock("latest");
    const baseFee = block?.baseFeePerGas || 0n;
    const nonce = await authSigner.getNonce()

    const maxPriorityFeePerGas = ethers.parseUnits("1", "gwei");
    const maxFeePerGas = baseFee * 2n;
    const tx: TransactionRequest = {
        type: 2,
        chainId: Number(chainId),
        from: authSigner.address,
        to: toAddress,
        nonce,
        value: amount,
        gasLimit: 200000,
        maxFeePerGas: maxFeePerGas,
        // This check is for testsnets where baseFeePerGas is usually smaller than maxPriorityFeePerGas
        maxPriorityFeePerGas: maxPriorityFeePerGas >= maxFeePerGas ? maxFeePerGas : maxPriorityFeePerGas,
    };

    const signedTx = await authSigner.signTransaction(tx);

    const BLOCK_RANGE_SIZE = 25;

    const targetBlock = await provider.getBlockNumber();
    const maxBlockNumber = targetBlock + BLOCK_RANGE_SIZE;

    const bundle = [
        { tx: signedTx, canRevert: false },
    ]

    const shareTx: TransactionOptions = {
        hints: {
            logs: true,
            calldata: true,
            functionSelector: true,
            contractAddress: true,
        },
        maxBlockNumber: maxBlockNumber,
        builders: chainId == "1" ? [
            "flashbots",
            "f1b.io",
            "rsync",
            "beaverbuild.org",
            "builder0x69",
            "Titan",
            "EigenPhi",
            "boba-builder",
            "Gambit Labs",
            "payload",
        ] : undefined
    };


    const transactionsResult = await mevShareClient.sendTransaction(signedTx, shareTx);

    console.log("Transaction result: ", transactionsResult);


    // Send a bundle with the transaction
    // const params: BundleParams = {
    //     inclusion: {
    //         block: targetBlock,
    //         maxBlock: maxBlockNumber,
    //     },
    //     body: bundle,
    // }

    // const bundleResult = await mevShareClient.sendBundle(params)

    // console.log("Bundle result: ", bundleResult);

    while (!foundTx) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("Closing handlers")
    txHandler.close()
    bundleHandler.close()
}

main();

