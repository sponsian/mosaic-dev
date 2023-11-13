import { EthersMosaic } from "@liquity/lib-ethers";

import { deployer, subgraph } from "../globals";

import {
  checkSubgraph,
  checkTroveOrdering,
  dumpTroves,
  getListOfTrovesBeforeRedistribution
} from "../utils";

export const checkSorting = async () => {
  const deployerMosaic = await EthersMosaic.connect(deployer);
  const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerMosaic);
  const totalRedistributed = await deployerMosaic.getTotalRedistributed();
  const price = await deployerMosaic.getPrice();

  checkTroveOrdering(listOfTroves, totalRedistributed, price);

  console.log("All Troves are sorted.");
};

export const checkSubgraphCmd = async () => {
  const deployerMosaic = await EthersMosaic.connect(deployer);

  await checkSubgraph(subgraph, deployerMosaic);

  console.log("Subgraph looks fine.");
};

export const dumpTrovesCmd = async () => {
  const deployerMosaic = await EthersMosaic.connect(deployer);
  const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerMosaic);
  const totalRedistributed = await deployerMosaic.getTotalRedistributed();
  const price = await deployerMosaic.getPrice();

  dumpTroves(listOfTroves, totalRedistributed, price);
};
