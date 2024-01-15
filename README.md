
# Oval-Quickstart Repository Overview

## Introduction
This repository is designed to provide practical demonstrations and examples of how to test Oval in different environments. It currently features two key examples:

1. **Aave Liquidation Fork**: A mainnet fork example showing the integration of Oval in Aave. This demo includes a series of unit tests to illustrate the integration process. [Aave Liquidation Fork README](./test/readme.md)

2. **Liquidation Demo in Goerli with Flashbots**: This example showcases a complete Oval workflow on the Goerli test network, utilizing Flashbots for efficient execution. It includes scripts and sample contracts to demonstrate the entire process from monitoring price feeds to executing liquidations. [Goerli Flashbots Integration README](./liquidation-demo-flashbots/readme.md)

## Demos Overview

### Aave Liquidation Fork
This demo provides a technical example of how Oval can be integrated into the Aave protocol. It focuses on minimal changes required for this integration and demonstrates how Oval can replace Chainlink in the oracle flow of Aave without disrupting its operations.

### Liquidation Demo in Goerli with Flashbots
This technical example illustrates an end-to-end Oval workflow within the Goerli test network, utilizing Flashbots. It covers the process of a searcher monitoring a Price Feed update and participating in Oval auctions, leading to the execution of a liquidation. The example also includes numerical demonstrations of the profit realized from these operations.

## Getting Started
To begin exploring these demos, clone the `oval-quickstart` repository and follow the individual READMEs for each demo. Each README provides detailed instructions on prerequisites, setup, and execution steps.

```bash
git clone https://github.com/UMAprotocol/oval-quickstart.git
```

## Additional Resources
For more information on Oval and its applications, please refer to the Oval documentation.