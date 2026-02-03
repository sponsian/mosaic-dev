const deploymentHelper = require("../utils/deploymentHelpers.js")

contract('Deployment script - Sets correct contract addresses dependencies after deployment', async accounts => {
  const [owner] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
  let priceFeed
  let msicToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let msicStaking
  let msicToken
  let communityIssuance
  let lockupContractFactory

  before(async () => {
    const coreContracts = await deploymentHelper.deployMosaicCore()
    const MSICContracts = await deploymentHelper.deployMSICContracts(bountyAddress, lpRewardsAddress, multisig)

    priceFeed = coreContracts.priceFeedTestnet
    msicToken = coreContracts.msicToken
    sortedTroves = coreContracts.sortedTroves
    troveManager = coreContracts.troveManager
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations

    msicStaking = MSICContracts.msicStaking
    msicToken = MSICContracts.msicToken
    communityIssuance = MSICContracts.communityIssuance
    lockupContractFactory = MSICContracts.lockupContractFactory

    await deploymentHelper.connectMSICContracts(MSICContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, MSICContracts)
    await deploymentHelper.connectMSICContractsToCore(MSICContracts, coreContracts)
  })

  it('Sets the correct PriceFeed address in TroveManager', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await troveManager.priceFeed()

    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  it('Sets the correct MEURToken address in TroveManager', async () => {
    const msicTokenAddress = msicToken.address

    const recordedClvTokenAddress = await troveManager.msicToken()

    assert.equal(msicTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct SortedTroves address in TroveManager', async () => {
    const sortedTrovesAddress = sortedTroves.address

    const recordedSortedTrovesAddress = await troveManager.sortedTroves()

    assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress)
  })

  it('Sets the correct BorrowerOperations address in TroveManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await troveManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ActivePool in TroveM
  it('Sets the correct ActivePool address in TroveManager', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddresss = await troveManager.activePool()

    assert.equal(activePoolAddress, recordedActivePoolAddresss)
  })

  // DefaultPool in TroveM
  it('Sets the correct DefaultPool address in TroveManager', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddresss = await troveManager.defaultPool()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddresss)
  })

  // StabilityPool in TroveM
  it('Sets the correct StabilityPool address in TroveManager', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddresss = await troveManager.stabilityPool()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddresss)
  })

  // MSIC Staking in TroveM
  it('Sets the correct MSICStaking address in TroveManager', async () => {
    const msicStakingAddress = msicStaking.address

    const recordedMSICStakingAddress = await troveManager.msicStaking()
    assert.equal(msicStakingAddress, recordedMSICStakingAddress)
  })

  // Active Pool

  it('Sets the correct StabilityPool address in ActivePool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await activePool.stabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('Sets the correct DefaultPool address in ActivePool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await activePool.defaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('Sets the correct BorrowerOperations address in ActivePool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await activePool.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct TroveManager address in ActivePool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await activePool.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Stability Pool

  it('Sets the correct ActivePool address in StabilityPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await stabilityPool.activePool()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct BorrowerOperations address in StabilityPool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await stabilityPool.borrowerOperations()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct MEURToken address in StabilityPool', async () => {
    const msicTokenAddress = msicToken.address

    const recordedClvTokenAddress = await stabilityPool.msicToken()

    assert.equal(msicTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct TroveManager address in StabilityPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await stabilityPool.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Default Pool

  it('Sets the correct TroveManager address in DefaultPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await defaultPool.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  it('Sets the correct ActivePool address in DefaultPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await defaultPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct TroveManager address in SortedTroves', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await sortedTroves.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct BorrowerOperations address in SortedTroves', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await sortedTroves.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  //--- BorrowerOperations ---

  // TroveManager in BO
  it('Sets the correct TroveManager address in BorrowerOperations', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await borrowerOperations.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // setPriceFeed in BO
  it('Sets the correct PriceFeed address in BorrowerOperations', async () => {
    const priceFeedAddress = priceFeed.address

    const recordedPriceFeedAddress = await borrowerOperations.priceFeed()
    assert.equal(priceFeedAddress, recordedPriceFeedAddress)
  })

  // setSortedTroves in BO
  it('Sets the correct SortedTroves address in BorrowerOperations', async () => {
    const sortedTrovesAddress = sortedTroves.address

    const recordedSortedTrovesAddress = await borrowerOperations.sortedTroves()
    assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress)
  })

  // setActivePool in BO
  it('Sets the correct ActivePool address in BorrowerOperations', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await borrowerOperations.activePool()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // setDefaultPool in BO
  it('Sets the correct DefaultPool address in BorrowerOperations', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await borrowerOperations.defaultPool()
    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  // MSIC Staking in BO
  it('Sets the correct MSICStaking address in BorrowerOperations', async () => {
    const msicStakingAddress = msicStaking.address

    const recordedMSICStakingAddress = await borrowerOperations.msicStakingAddress()
    assert.equal(msicStakingAddress, recordedMSICStakingAddress)
  })


  // --- MSIC Staking ---

  // Sets MSICToken in MSICStaking
  it('Sets the correct MSICToken address in MSICStaking', async () => {
    const msicTokenAddress = msicToken.address

    const recordedMSICTokenAddress = await msicStaking.msicToken()
    assert.equal(msicTokenAddress, recordedMSICTokenAddress)
  })

  // Sets ActivePool in MSICStaking
  it('Sets the correct ActivePool address in MSICStaking', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await msicStaking.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // Sets MEURToken in MSICStaking
  it('Sets the correct ActivePool address in MSICStaking', async () => {
    const msicTokenAddress = msicToken.address

    const recordedMEURTokenAddress = await msicStaking.msicToken()
    assert.equal(msicTokenAddress, recordedMEURTokenAddress)
  })

  // Sets TroveManager in MSICStaking
  it('Sets the correct ActivePool address in MSICStaking', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await msicStaking.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Sets BorrowerOperations in MSICStaking
  it('Sets the correct BorrowerOperations address in MSICStaking', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await msicStaking.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ---  MSICToken ---

  // Sets CI in MSICToken
  it('Sets the correct CommunityIssuance address in MSICToken', async () => {
    const communityIssuanceAddress = communityIssuance.address

    const recordedcommunityIssuanceAddress = await msicToken.communityIssuanceAddress()
    assert.equal(communityIssuanceAddress, recordedcommunityIssuanceAddress)
  })

  // Sets MSICStaking in MSICToken
  it('Sets the correct MSICStaking address in MSICToken', async () => {
    const msicStakingAddress = msicStaking.address

    const recordedMSICStakingAddress =  await msicToken.msicStakingAddress()
    assert.equal(msicStakingAddress, recordedMSICStakingAddress)
  })

  // Sets LCF in MSICToken
  it('Sets the correct LockupContractFactory address in MSICToken', async () => {
    const LCFAddress = lockupContractFactory.address

    const recordedLCFAddress =  await msicToken.lockupContractFactory()
    assert.equal(LCFAddress, recordedLCFAddress)
  })

  // --- LCF  ---

  // Sets MSICToken in LockupContractFactory
  it('Sets the correct MSICToken address in LockupContractFactory', async () => {
    const msicTokenAddress = msicToken.address

    const recordedMSICTokenAddress = await lockupContractFactory.msicTokenAddress()
    assert.equal(msicTokenAddress, recordedMSICTokenAddress)
  })

  // --- CI ---

  // Sets MSICToken in CommunityIssuance
  it('Sets the correct MSICToken address in CommunityIssuance', async () => {
    const msicTokenAddress = msicToken.address

    const recordedMSICTokenAddress = await communityIssuance.msicToken()
    assert.equal(msicTokenAddress, recordedMSICTokenAddress)
  })

  it('Sets the correct StabilityPool address in CommunityIssuance', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await communityIssuance.stabilityPoolAddress()
    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })
})
