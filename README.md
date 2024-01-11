## Liquidation Demo in Goerli

### 1. Deploy the contracts

```shell
forge script ./src/script/OvalLiquidationDemo.s.sol:OvalLiquidationDemoScript --rpc-url https://goerli.infura.io/v3/<YOUR-INFURA-KEY> --private-key <YOUR-PRIVATE-KEY> --broadcast --verify --etherscan-api-key <YOUR-ETHERSCAN-API-KEY>
```

### 2. Prepare environment variables

Create a `.env` file in the `scripts` directory with the following content:

```shell
NODE_URL_5=<YOUR-ETHEREUM-NODE-URL>
CHAIN_ID=5
PRIVATE_KEY=<DEPLOYER-PRIVATE-KEY>
OVAL_LIQUIDATION_DEMO_PRICE_FEED_ADDRESS=<DEPLOYED-PRICE-FEED-ADDRESS>
CHAINLINK_OVAL_IMMUTABLE_ADDRESS=<DEPLOYED-OVAL-ADDRESS>
OVAL_LIQUIDATION_DEMO_ADDRESS=<DEPLOYED-LIQUIDATION-DEMO-ADDRESS>
PAY_BUILDER_ADDRESS=<DEPLOYED-PAY-BUILDER-ADDRESS>
```

### 3. Generate types and build demo script

Run the following commands:
```shell
forge build
cd scripts
yarn && yarn generate-contract-types && yarn build
```

### 4. Run the demo script

```shell
node ./out/src/GoerliBundleConstruction.js
```
