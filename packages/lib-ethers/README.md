# @mosaic/lib-ethers

[Ethers](https://www.npmjs.com/package/ethers)-based library for reading Mosaic protocol state and sending transactions.

## Quickstart

Install in your project:

```
npm install --save @mosaic/lib-base @mosaic/lib-ethers ethers@^5.0.0
```

Connecting to an Ethereum node and sending a transaction:

```javascript
const { Wallet, providers } = require("ethers");
const { EthersMosaic } = require("@mosaic/lib-ethers");

async function example() {
  const provider = new providers.JsonRpcProvider("http://localhost:8545");
  const wallet = new Wallet(process.env.PRIVATE_KEY).connect(provider);
  const mosaic = await EthersMosaic.connect(wallet);

  const { newTrove } = await mosaic.openTrove({
    depositCollateral: 5, // ETH
    borrowMoUSD: 2000
  });

  console.log(`Successfully opened a Mosaic Trove (${newTrove})!`);
}
```

## More examples

See [packages/examples](https://github.com/mosaic/mosaic/tree/master/packages/examples) in the repo.

Mosaic's [Dev UI](https://github.com/mosaic/mosaic/tree/master/packages/dev-frontend) itself contains many examples of `@mosaic/lib-ethers` use.

## API Reference

For now, it can be found in the public Mosaic [repo](https://github.com/mosaic/mosaic/blob/master/docs/sdk/lib-ethers.md).

