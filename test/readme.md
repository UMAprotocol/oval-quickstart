# Oval Integration in Aave: Mainnet Fork Example

## Overview

This README provides a guide on how to use Oval in Aave through a mainnet fork. It includes a set of unit tests demonstrating the minimal changes required for integrating Oval into protocols like Aave by replacing Chainlink with Oval in the oracle flow. This walkthrough uses the Oval version detailed on the associated documentation page.

## Running the Aave Integration Mainnet Fork Test

### Prerequisites

To run this test, you will need:

- **Foundry Installation**: Install Foundry from [here](https://foundry.paradigm.xyz/).
- **Mainnet RPC URL**: Any standard mainnet RPC URL, such as Infura, will be suitable.

### Setup

Clone the Oval Playground and install dependencies with the following commands:
```bash
git clone https://github.com/UMAprotocol/oval-quickstart.git
cd oval-quickstart
forge install
forge build
```

### Executing the Tests

1.  **Set Environment Variable**: Before running the tests, ensure that the RPC_MAINNET environment variable is set to access historical Ethereum state. If you have already set this in a `.env` file from another Oval tutorial, you can skip this step.
   ```bash
   export RPC_MAINNET=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
   ```

2.  **Run the Tests**: Execute the tests with the following command:
   ```bash
   forge test
   ```

    The test script forks the Ethereum mainnet to a state before a specific price feed event, allowing you to observe the impact of this event and subsequent liquidation. You can investigate the specific liquidation using tools like Eigenpi.

## Additional Information

For more details on Oval integration and its operation within Aave, refer to the provided documentation and examples. This guide assumes familiarity with Ethereum mainnet forking and the use of RPC URLs for blockchain interaction.
