const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const MEURToken = artifacts.require("./MEURToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const GasPool = artifacts.require("./GasPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")

const MSICStaking = artifacts.require("./MSICStaking.sol")
const MSICToken = artifacts.require("./MSICToken.sol")
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")

const Unipool =  artifacts.require("./Unipool.sol")

const MSICTokenTester = artifacts.require("./MSICTokenTester.sol")
const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol")
const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol")
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")
const MosaicMathTester = artifacts.require("./MosaicMathTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const MEURTokenTester = artifacts.require("./MEURTokenTester.sol")

// Proxy scripts
const BorrowerOperationsScript = artifacts.require('BorrowerOperationsScript')
const BorrowerWrappersScript = artifacts.require('BorrowerWrappersScript')
const TroveManagerScript = artifacts.require('TroveManagerScript')
const StabilityPoolScript = artifacts.require('StabilityPoolScript')
const TokenScript = artifacts.require('TokenScript')
const MSICStakingScript = artifacts.require('MSICStakingScript')
const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  TroveManagerProxy,
  StabilityPoolProxy,
  SortedTrovesProxy,
  TokenProxy,
  MSICStakingProxy
} = require('../utils/proxyHelpers.js')

/* "Mosaic core" consists of all contracts in the core Mosaic system.

MSIC contracts consist of only those contracts related to the MSIC Token:

-the MSIC token
-the Lockup factory and lockup contracts
-the MSICStaking contract
-the CommunityIssuance contract 
*/

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {

  static async deployMosaicCore() {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployMosaicCoreHardhat()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployMosaicCoreTruffle()
    }
  }

  static async deployMSICContracts(bountyAddress, lpRewardsAddress, multisigAddress) {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployMSICContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress)
    } else if (frameworkPath.includes("truffle")) {
      return this.deployMSICContractsTruffle(bountyAddress, lpRewardsAddress, multisigAddress)
    }
  }

  static async deployMosaicCoreHardhat() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const troveManager = await TroveManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const msicToken = await MEURToken.new(
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    MEURToken.setAsDeployed(msicToken)
    DefaultPool.setAsDeployed(defaultPool)
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet)
    SortedTroves.setAsDeployed(sortedTroves)
    TroveManager.setAsDeployed(troveManager)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    GasPool.setAsDeployed(gasPool)
    CollSurplusPool.setAsDeployed(collSurplusPool)
    FunctionCaller.setAsDeployed(functionCaller)
    BorrowerOperations.setAsDeployed(borrowerOperations)
    HintHelpers.setAsDeployed(hintHelpers)

    const coreContracts = {
      priceFeedTestnet,
      msicToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deployTesterContractsHardhat() {
    const testerContracts = {}

    // Contract without testers (yet)
    testerContracts.priceFeedTestnet = await PriceFeedTestnet.new()
    testerContracts.sortedTroves = await SortedTroves.new()
    // Actual tester contracts
    testerContracts.communityIssuance = await CommunityIssuanceTester.new()
    testerContracts.activePool = await ActivePoolTester.new()
    testerContracts.defaultPool = await DefaultPoolTester.new()
    testerContracts.stabilityPool = await StabilityPoolTester.new()
    testerContracts.gasPool = await GasPool.new()
    testerContracts.collSurplusPool = await CollSurplusPool.new()
    testerContracts.math = await MosaicMathTester.new()
    testerContracts.borrowerOperations = await BorrowerOperationsTester.new()
    testerContracts.troveManager = await TroveManagerTester.new()
    testerContracts.functionCaller = await FunctionCaller.new()
    testerContracts.hintHelpers = await HintHelpers.new()
    testerContracts.msicToken =  await MEURTokenTester.new(
      testerContracts.troveManager.address,
      testerContracts.stabilityPool.address,
      testerContracts.borrowerOperations.address
    )
    return testerContracts
  }

  static async deployMSICContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress) {
    const msicStaking = await MSICStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    MSICStaking.setAsDeployed(msicStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuance.setAsDeployed(communityIssuance)

    // Deploy MSIC Token, passing Community Issuance and Factory addresses to the constructor 
    const msicToken = await MSICToken.new(
      communityIssuance.address, 
      msicStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    )
    MSICToken.setAsDeployed(msicToken)

    const MSICContracts = {
      msicStaking,
      lockupContractFactory,
      communityIssuance,
      msicToken
    }
    return MSICContracts
  }

  static async deployMSICTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress) {
    const msicStaking = await MSICStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuanceTester.new()

    MSICStaking.setAsDeployed(msicStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuanceTester.setAsDeployed(communityIssuance)

    // Deploy MSIC Token, passing Community Issuance and Factory addresses to the constructor 
    const msicToken = await MSICTokenTester.new(
      communityIssuance.address, 
      msicStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    )
    MSICTokenTester.setAsDeployed(msicToken)

    const MSICContracts = {
      msicStaking,
      lockupContractFactory,
      communityIssuance,
      msicToken
    }
    return MSICContracts
  }

  static async deployMosaicCoreTruffle() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const troveManager = await TroveManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const msicToken = await MEURToken.new(
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    const coreContracts = {
      priceFeedTestnet,
      msicToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deployMSICContractsTruffle(bountyAddress, lpRewardsAddress, multisigAddress) {
    const msicStaking = await msicStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    /* Deploy MSIC Token, passing Community Issuance,  MSICStaking, and Factory addresses 
    to the constructor  */
    const msicToken = await MSICToken.new(
      communityIssuance.address, 
      msicStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress, 
      multisigAddress
    )

    const MSICContracts = {
      msicStaking,
      lockupContractFactory,
      communityIssuance,
      msicToken
    }
    return MSICContracts
  }

  static async deployMEURToken(contracts) {
    contracts.msicToken = await MEURToken.new(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployMEURTokenTester(contracts) {
    contracts.msicToken = await MEURTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployProxyScripts(contracts, MSICContracts, owner, users) {
    const proxies = await buildUserProxies(users)

    const borrowerWrappersScript = await BorrowerWrappersScript.new(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      MSICContracts.msicStaking.address
    )
    contracts.borrowerWrappers = new BorrowerWrappersProxy(owner, proxies, borrowerWrappersScript.address)

    const borrowerOperationsScript = await BorrowerOperationsScript.new(contracts.borrowerOperations.address)
    contracts.borrowerOperations = new BorrowerOperationsProxy(owner, proxies, borrowerOperationsScript.address, contracts.borrowerOperations)

    const troveManagerScript = await TroveManagerScript.new(contracts.troveManager.address)
    contracts.troveManager = new TroveManagerProxy(owner, proxies, troveManagerScript.address, contracts.troveManager)

    const stabilityPoolScript = await StabilityPoolScript.new(contracts.stabilityPool.address)
    contracts.stabilityPool = new StabilityPoolProxy(owner, proxies, stabilityPoolScript.address, contracts.stabilityPool)

    contracts.sortedTroves = new SortedTrovesProxy(owner, proxies, contracts.sortedTroves)

    const msicTokenScript = await TokenScript.new(contracts.msicToken.address)
    contracts.msicToken = new TokenProxy(owner, proxies, msicTokenScript.address, contracts.msicToken)

    const msicTokenScript = await TokenScript.new(MSICContracts.msicToken.address)
    MSICContracts.msicToken = new TokenProxy(owner, proxies, msicTokenScript.address, MSICContracts.msicToken)

    const msicStakingScript = await MSICStakingScript.new(MSICContracts.msicStaking.address)
    MSICContracts.msicStaking = new MSICStakingProxy(owner, proxies, msicStakingScript.address, MSICContracts.msicStaking)
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, MSICContracts) {

    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      maxBytes32,
      contracts.troveManager.address,
      contracts.borrowerOperations.address
    )

    // set contract addresses in the FunctionCaller 
    await contracts.functionCaller.setTroveManagerAddress(contracts.troveManager.address)
    await contracts.functionCaller.setSortedTrovesAddress(contracts.sortedTroves.address)

    // set contracts in the Trove Manager
    await contracts.troveManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.msicToken.address,
      contracts.sortedTroves.address,
      MSICContracts.msicToken.address,
      MSICContracts.msicStaking.address
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.sortedTroves.address,
      contracts.msicToken.address,
      MSICContracts.msicStaking.address
    )

    // set contracts in the Pools
    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.msicToken.address,
      contracts.sortedTroves.address,
      contracts.priceFeedTestnet.address,
      MSICContracts.communityIssuance.address
    )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address
    )

    await contracts.defaultPool.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
    )

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
    )

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.sortedTroves.address,
      contracts.troveManager.address
    )
  }

  static async connectMSICContracts(MSICContracts) {
    // Set MSICToken address in LCF
    await MSICContracts.lockupContractFactory.setMSICTokenAddress(MSICContracts.msicToken.address)
  }

  static async connectMSICContractsToCore(MSICContracts, coreContracts) {
    await MSICContracts.msicStaking.setAddresses(
      MSICContracts.msicToken.address,
      coreContracts.msicToken.address,
      coreContracts.troveManager.address, 
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address
    )
  
    await MSICContracts.communityIssuance.setAddresses(
      MSICContracts.msicToken.address,
      coreContracts.stabilityPool.address
    )
  }

  static async connectUnipool(uniPool, MSICContracts, uniswapPairAddr, duration) {
    await uniPool.setParams(MSICContracts.msicToken.address, uniswapPairAddr, duration)
  }
}
module.exports = DeploymentHelper
