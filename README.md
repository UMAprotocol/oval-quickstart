
# Oval Quickstart
<p align="center">
  <img alt="UMA Logo" src="https://i.imgur.com/fSkkK5M.png" width="440">
</p>

Oval Quickstart is a comprehensive repository designed to showcase practical implementations and testing of Oval in various environments. Oval, a mechanism for capturing Oracle Extractable Value (OEV) through auctions, integrates with Flashbot's [MEV-share](https://docs.flashbots.net/flashbots-protect/mev-share) system, allowing for the auctioning of oracle updates.

For detailed information on Oval's functionality and integration processes, refer to the [Oval documentation](https://docs.oval.xyz/).

## Repo Contents

This repository features essential components for understanding and utilizing Oval, including:

### ChainlinkOvalImmutable Contract

-   A standard instance of an Oval contract, exemplifying the most streamlined setup using Chainlink and the Immutable controller. Comprehensive guidance for deployment and practical usage is detailed in the [ChainlinkOvalImmutable deployment](#chainlinkovalimmutable-deployment) section of this document, providing step-by-step instructions

### Demos

-   **Aave Liquidation Fork**: A mainnet fork example showing the integration of Oval in Aave. This demo includes a series of unit tests to illustrate the integration process. [Aave Liquidation Fork README](./test/readme.md)

-   **Liquidation Demo in Goerli with Flashbots**: This example showcases a complete Oval workflow on the Goerli test network, utilizing Flashbots for efficient execution. It includes scripts and sample contracts to demonstrate the entire process from monitoring price feeds to executing liquidations. [Goerli Flashbots Integration README](./liquidation-demo-flashbots/readme.md)

### Building and Testing

-   The repository utilizes [Foundry](https://github.com/foundry-rs/foundry) for contract development and testing.  For the liquidation demo, Node.js is utilized to handle script execution and orchestration.
-   Detailed instructions for each demo, including specific setup steps and testing procedures, are provided within their respective instructions.
  
## ChainlinkOvalImmutable deployment

The [Oval contracts](https://github.com/UMAprotocol/oval-contracts) are designed to be composable and modular, enabling the deployer to customize them to their needs. [ChainlinkOvalImmutable](./src/ChainlinkOvalImmutable.sol) is the minimal viable Oval configuration that is perfect for getting started. This Oval contract uses Chainlink as [source](https://github.com/UMAprotocol/oval-contracts/blob/master/src/adapters/source-adapters/ChainlinkSourceAdapter.sol) and [destination](https://github.com/UMAprotocol/oval-contracts/blob/master/src/adapters/destination-adapters/ChainlinkDestinationAdapter.sol) and uses the [Immutable](https://github.com/UMAprotocol/oval-contracts/blob/master/src/controllers/ImmutableController.sol) controller to manage the Oval instance.

To deploy your own instance of this contract follow these steps:

### **0. Prerequisites:**

This guide makes some assumptions:

1. Foundry is installed on your machine. If not, it can be found [here](https://book.getfoundry.sh/getting-started/installation).
2. You have a wallet and the associated private key for the network you want to deploy on. If deploying on Goerli, you can fund your wallet [here](https://goerlifaucet.com/) or [here](https://goerli-faucet.pk910.de/) or [here](https://chainstack.com/goerli-faucet/).
3. You know what address you want to set as the [permissioned actor](../mechanism-design/mechanism-description.md) that can initiate an auction. If this is a production mainnet deployment, reach out to the UMA team. You can contact us on [discord](https://discord.uma.xyz).
4. You know the address of the Chainlink oracle you want to connect to. A full list of Chainlink oracles can be found [here](https://data.chain.link/ethereum/mainnet/crypto-usd).
5. You have an RPC URL to connect to. If not, you can get one from [Infura](https://www.infura.io/).

### 1. Clone the Quickstart repo and install dependencies

```bash
git clone https://github.com/UMAprotocol/oval-quickstart.git
cd oval-quickstart
forge install
```

### **2. Configure the deployment options**

Next, you need to configure the deployment options given your desired configuration. This is done through an environment file. There is a sample env within the repo that you can modify. To do this run:

```bash
cp example.env .env
```

Then open the `.env` file with your favorite editor and change its contents accordingly. It should look something like this:

```bash
PRIVATE_KEY=0xPUT_YOUR_PRIVATE_KEY_HERE # This account will do the deployment
SOURCE_ADDRESS=0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419 # example Chainlink ETH/USD
LOCK_WINDOW=60 # How long each update is blocked for OEV auction to run.
MAX_TRAVERSAL=4 # How many iterations to look back for historic data.
UNLOCKERS=0xPUT_YOUR_UNLOCKER_ADDRESS_HERE # Your address or address provided on Discord.
RPC_MAINNET=PUT_YOUR_RPC_URL_HERE # Your network or fork RPC Url.
```

A note on the `UNLOCKERS`: This setting is the most complex within the config. This is the actor that can initiate the Oval auction (see [here](../mechanism-design/mechanism-description.md#permissioned-auction-unlockers)). If you are using the [UMA Oval RPC](../for-searchers/oval-node.md) then you will need to place a custom address that the UMA integration teams will give you in this field. Otherwise, this address should be something you can control and is used to initiate the auction within MEV-Share.

#### **Note on `RPC_MAINNET`**

if you want to deploy this within an Anvil fork then run:

```bash
anvil --fork-url YOUR_RPC_URL_HERE
```

And set the RPC\_MAINNET value within the `.env` file to `http://127.0.0.1:8545`. Doing this will let you deploy your Oval instance to a local mainnet fork which can be useful for testing.

### **3. Deploy the ChainlinkOvalImmutable**

Next, we can execute the deployment script to deploy your Oval contract. This can be run as follows:

```bash
source .env # Load the variables in the .env file

forge script ./src/ChainlinkOvalImmutable.s.sol --rpc-url $RPC_MAINNET --broadcast
```

This will output the deployment address of your Oval instance. You then need to configure your protocol to use this address in place of the associated Chainlink deployment.&#x20;