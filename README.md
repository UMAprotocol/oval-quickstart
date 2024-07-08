# Oval Quickstart

<p align="center"> <img alt="UMA Logo" src="https://i.imgur.com/fSkkK5M.png" width="440"> </p>

Oval Quickstart is a comprehensive repository designed to showcase practical implementations and testing of Oval in various environments. Oval, a mechanism for capturing Oracle Extractable Value (OEV) through auctions, integrates with Flashbots' [MEV-share](https://docs.flashbots.net/flashbots-protect/mev-share) system, allowing for the auctioning of oracle updates.

For detailed information on Oval's functionality and integration processes, refer to the [Oval documentation](https://docs.oval.xyz/).

## Repo Contents

This repository features essential components for understanding and utilizing Oval, including:

### `ChainlinkOvalImmutable` Contract

- A standard instance of an Oval contract, exemplifying the most streamlined setup using Chainlink and the `ImmutableController`. Comprehensive guidance for deployment and practical usage is detailed in the [ChainlinkOvalImmutable deployment](#chainlinkovalimmutable-deployment) section of this document, providing step-by-step instructions.

### Demos

- **Aave Liquidation Fork**: A mainnet fork example showing the integration of Oval in Aave. This demo includes a series of unit tests to illustrate the integration process. [Aave Liquidation Fork README](./test/readme.md).
- **Liquidation Demo in Sepolia with Flashbots**: This example showcases a complete Oval workflow on the Sepolia test network, utilizing Flashbots for efficient execution. It includes scripts and sample contracts to demonstrate the entire process from monitoring price feeds to executing liquidations. [Sepolia Flashbots Integration README](./liquidation-demo-flashbots/readme.md).

### Building and Testing

- The repository utilizes [Foundry](https://github.com/foundry-rs/foundry) for contract development and testing. For the liquidation demo, Node.js is utilized to handle script execution and orchestration.
- Detailed instructions for each demo, including specific setup steps and testing procedures, are provided within their respective instructions.

## ChainlinkOvalImmutable deployment

For detailed information on the contract's functionality, please refer to the [Getting Started](https://docs.oval.xyz/integration/getting-started) documentation.

To deploy your own instance of this contract, follow these steps:

### **0. Prerequisites:**

This guide makes some assumptions:

1.  Foundry is installed on your machine. If not, it can be found [here](https://book.getfoundry.sh/getting-started/installation).
2.  You have a wallet and the associated private key for the network you want to deploy on. If deploying on Sepolia, you can fund your wallet [here](https://www.alchemy.com/faucets/ethereum-sepolia), [here](https://sepolia-faucet.pk910.de/) or [here](https://www.sepoliafaucet.io/)
3.  You know the address you want to set as the [permissioned actor](https://docs.oval.xyz/mechanism-details/mechanism-description) that can initiate an auction. If this is a production mainnet deployment, reach out to the UMA team. You can contact us on [Discord](https://discord.uma.xyz/).
4.  You know the address of the Chainlink oracle you want to connect to. A full list of Chainlink oracles can be found [here](https://data.chain.link/ethereum/mainnet/crypto-usd).
5.  You have an RPC URL to connect to. If not, you can get one from [Infura](https://www.infura.io/).

### 1. Clone the Quickstart repo and install dependencies

```bash
git clone https://github.com/UMAprotocol/oval-quickstart.git
cd oval-quickstart
forge install
```

### **2. Configure the deployment options**

Next, you need to configure the deployment options based on your desired configuration. This is done through an environment file. There is a sample env file within the repo that you can modify. To do this, run:

```bash
cp example.env .env
```

Then open the `.env` file with your favorite editor and change its contents accordingly. It should look something like this:

```bash
PRIVATE_KEY=0xPUT_YOUR_PRIVATE_KEY_HERE # This account will do the deployment
SOURCE_ADDRESS=0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419 # example Chainlink ETH/USD
LOCK_WINDOW=60 # How long each update is blocked for OEV auction to run.
MAX_TRAVERSAL=4 # How many iterations to look back for historic data.
UNLOCKER=0xPUT_YOUR_UNLOCKER_ADDRESS_HERE # Your unlocker address provided on Discord.
RPC_MAINNET=PUT_YOUR_RPC_URL_HERE # Your network or fork RPC Url.
```

For more information on these variables, refer to the [Oval documentation](https://docs.oval.xyz/integration/getting-started).

#### **Note on `RPC_MAINNET`**

If you want to deploy this within an Anvil fork, then run:

```bash
anvil --fork-url YOUR_RPC_URL_HERE
```

And set the RPC_MAINNET value within the `.env` file to `http://127.0.0.1:8545`. Doing this will let you deploy your Oval instance to a local mainnet fork, which can be useful for testing.

### **3. Deploy the ChainlinkOvalImmutable**

Next, we can execute the deployment script to deploy your Oval contract. This can be run as follows:

```bash
source .env # Load the variables in the .env file

forge script ./src/ChainlinkOvalImmutable.s.sol --rpc-url $RPC_MAINNET --broadcast
```

This will output the deployment address of your Oval instance. You then need to configure your protocol to use this address in place of the associated Chainlink deployment.
