# Oval Integration in Sepolia with Flashbots: End-to-End Workflow Example

## Overview

This README outlines the process of demonstrating a complete Oval workflow on the Sepolia test network using Flashbots. It includes monitoring a Price Feed update, participating in Oval auctions, and executing liquidations. The example also provides numerical demonstrations of profit realization by the searcher and the protocol's earnings from liquidation proceeds.

## Running the Sample Flashbots Integration on Sepolia

### Node.js Version Compatibility

Use **Node.js version 18.14.2 or 18.X** for optimal compatibility with Flashbots TypeScript libraries. Note: Event subscriptions may not function correctly with Node.js version 20.X.

### Prerequisites

To proceed with this demonstration, ensure you have:

- **Wallet with Private Key**: If deploying on Sepolia, you can fund your wallet [here](https://www.alchemy.com/faucets/ethereum-sepolia), [here](https://sepolia-faucet.pk910.de/) or [here](https://faucet.paradigm.xyz/).
- **Foundry Installation**: Install Foundry from [here](https://foundry.paradigm.xyz/).
- **Sepolia RPC URL**: Use Infura or similar services.
- **Etherscan API Key for Sepolia**: Optional, obtainable [here](https://etherscan.io/apis).

### Setup

Clone the Oval Quickstart repository and build the contracts:
```bash
git clone https://github.com/UMAprotocol/oval-quickstart.git
cd oval-quickstart
forge install
forge build
```

### Execution Steps

1.  **Deploy the Demo Contracts**: Run the following command in the root folder of the oval-quickstart repository:
   
   ```bash
   forge script ./src/liquidation-demo/script/OvalLiquidationDemo.s.sol:OvalLiquidationDemoScript \
   --rpc-url https://sepolia.infura.io/v3/<YOUR-INFURA-KEY> \
   --private-key <YOUR-PRIVATE-KEY> \
   --broadcast \
   --verify \
   --etherscan-api-key <YOUR-ETHERSCAN-API-KEY>
   ```

2.  **Run the Liquidation Script with Flashbots on Sepolia**: Fill in the contract addresses and necessary keys in a `.env` file as shown in `/liquidation-demo-flashbots/.env.example`:

   ```
   NODE_URL_11155111=https://sepolia.infura.io/v3/<YOUR-INFURA-KEY>
   CHAIN_ID=11155111
   PRIVATE_KEY=<YOUR-PRIVATE-KEY> # Ensure you have some ETH in Sepolia for testing
   OVAL_LIQUIDATION_DEMO_PRICE_FEED_ADDRESS=<YOUR-PRICE-FEED-ADDRESS>
   CHAINLINK_OVAL_IMMUTABLE_ADDRESS=<YOUR-OVAL-ADDRESS>
   OVAL_LIQUIDATION_DEMO_ADDRESS=<YOUR-LIQUIDATION-DEMO-ADDRESS>
   PAY_BUILDER_ADDRESS=<YOUR-PAY-BUILDER-ADDRESS>
   ```

   Then run the liquidation demo script from the `/liquidation-demo-flashbots` folder in oval-quickstart:

   ```bash
   cd liquidation-demo-flashbots
   yarn install && yarn build 
   yarn start
   ```
