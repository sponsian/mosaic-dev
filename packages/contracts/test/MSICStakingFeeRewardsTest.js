const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")

const MSICStakingTester = artifacts.require('MSICStakingTester')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const NonPayable = artifacts.require("./NonPayable.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert

const toBN = th.toBN
const ZERO = th.toBN('0')

const GAS_PRICE = 10000000

/* NOTE: These tests do not test for specific REEF and MEUR gain values. They only test that the 
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake. 
 *
 * Specific REEF/MEUR gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the TroveManager, which are still TBD based on economic
 * modelling.
 * 
 */ 

contract('MSICStaking revenue share tests', async accounts => {

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
  const [owner, A, B, C, D, E, F, G, whale] = accounts;

  let priceFeed
  let msicToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let msicStaking
  let msicToken

  let contracts

  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployMosaicCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployMEURTokenTester(contracts)
    const MSICContracts = await deploymentHelper.deployMSICTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)
    
    await deploymentHelper.connectMSICContracts(MSICContracts)
    await deploymentHelper.connectCoreContracts(contracts, MSICContracts)
    await deploymentHelper.connectMSICContractsToCore(MSICContracts, contracts)

    nonPayable = await NonPayable.new() 
    priceFeed = contracts.priceFeedTestnet
    msicToken = contracts.msicToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    msicToken = MSICContracts.msicToken
    msicStaking = MSICContracts.msicStaking
  })

  it('stake(): reverts if amount is zero', async () => {
    // FF time one year so owner can transfer MSIC
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A
    await msicToken.transfer(A, dec(100, 18), {from: multisig})

    // console.log(`A msic bal: ${await msicToken.balanceOf(A)}`)

    // A makes stake
    await msicToken.approve(msicStaking.address, dec(100, 18), {from: A})
    await assertRevert(msicStaking.stake(0, {from: A}), "MSICStaking: Amount must be non-zero")
  })

  it("REEF fee per MSIC staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extraMEURAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraMEURAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

    // FF time one year so owner can transfer MSIC
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A
    await msicToken.transfer(A, dec(100, 18), {from: multisig, gasPrice: GAS_PRICE})

    // console.log(`A msic bal: ${await msicToken.balanceOf(A)}`)

    // A makes stake
    await msicToken.approve(msicStaking.address, dec(100, 18), {from: A})
    await msicStaking.stake(dec(100, 18), {from: A})

    // Check REEF fee per unit staked is zero
    const F_ETH_Before = await msicStaking.F_ETH()
    assert.equal(F_ETH_Before, '0')

    const B_BalBeforeREdemption = await msicToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), GAS_PRICE)
    
    const B_BalAfterRedemption = await msicToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check REEF fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check REEF fee per unit staked has increased by correct amount
    const F_ETH_After = await msicStaking.F_ETH()

    // Expect fee per unit staked = fee/100, since there is 100 MEUR totalStaked
    const expected_F_ETH_After = emittedETHFee.div(toBN('100')) 

    assert.isTrue(expected_F_ETH_After.eq(F_ETH_After))
  })

  it("REEF fee per MSIC staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extraMEURAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraMEURAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MSIC
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A
    await msicToken.transfer(A, dec(100, 18), {from: multisig, gasPrice: GAS_PRICE})

    // Check REEF fee per unit staked is zero
    const F_ETH_Before = await msicStaking.F_ETH()
    assert.equal(F_ETH_Before, '0')

    const B_BalBeforeREdemption = await msicToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), GAS_PRICE)
    
    const B_BalAfterRedemption = await msicToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check REEF fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check REEF fee per unit staked has not increased 
    const F_ETH_After = await msicStaking.F_ETH()
    assert.equal(F_ETH_After, '0')
  })

  it("MEUR fee per MSIC staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extraMEURAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraMEURAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MSIC
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A
    await msicToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await msicToken.approve(msicStaking.address, dec(100, 18), {from: A})
    await msicStaking.stake(dec(100, 18), {from: A})

    // Check MEUR fee per unit staked is zero
    const F_MEUR_Before = await msicStaking.F_ETH()
    assert.equal(F_MEUR_Before, '0')

    const B_BalBeforeREdemption = await msicToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice= GAS_PRICE)
    
    const B_BalAfterRedemption = await msicToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawMEUR(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check MEUR fee value in event is non-zero
    const emittedMEURFee = toBN(th.getMEURFeeFromMEURBorrowingEvent(tx))
    assert.isTrue(emittedMEURFee.gt(toBN('0')))
    
    // Check MEUR fee per unit staked has increased by correct amount
    const F_MEUR_After = await msicStaking.F_MEUR()

    // Expect fee per unit staked = fee/100, since there is 100 MEUR totalStaked
    const expected_F_MEUR_After = emittedMEURFee.div(toBN('100')) 

    assert.isTrue(expected_F_MEUR_After.eq(F_MEUR_After))
  })

  it("MEUR fee per MSIC staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extraMEURAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraMEURAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MSIC
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A
    await msicToken.transfer(A, dec(100, 18), {from: multisig})

    // Check MEUR fee per unit staked is zero
    const F_MEUR_Before = await msicStaking.F_ETH()
    assert.equal(F_MEUR_Before, '0')

    const B_BalBeforeREdemption = await msicToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await msicToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawMEUR(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check MEUR fee value in event is non-zero
    const emittedMEURFee = toBN(th.getMEURFeeFromMEURBorrowingEvent(tx))
    assert.isTrue(emittedMEURFee.gt(toBN('0')))
    
    // Check MEUR fee per unit staked did not increase, is still zero
    const F_MEUR_After = await msicStaking.F_MEUR()
    assert.equal(F_MEUR_After, '0')
  })

  it("MSIC Staking: A single staker earns all REEF and MSIC fees that occur", async () => {
    await openTrove({ extraMEURAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraMEURAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MSIC
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A
    await msicToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await msicToken.approve(msicStaking.address, dec(100, 18), {from: A})
    await msicStaking.stake(dec(100, 18), {from: A})

    const B_BalBeforeREdemption = await msicToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await msicToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check REEF fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await msicToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await msicToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check REEF fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawMEUR(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check MEUR fee value in event is non-zero
    const emittedMEURFee_1 = toBN(th.getMEURFeeFromMEURBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedMEURFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawMEUR(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check MEUR fee value in event is non-zero
    const emittedMEURFee_2 = toBN(th.getMEURFeeFromMEURBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedMEURFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)
    const expectedTotalMEURGain = emittedMEURFee_1.add(emittedMEURFee_2)

    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_MEURBalance_Before = toBN(await msicToken.balanceOf(A))

    // A un-stakes
    const GAS_Used = th.gasUsed(await msicStaking.unstake(dec(100, 18), {from: A, gasPrice: GAS_PRICE }))

    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_MEURBalance_After = toBN(await msicToken.balanceOf(A))


    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before).add(toBN(GAS_Used * GAS_PRICE))
    const A_MEURGain = A_MEURBalance_After.sub(A_MEURBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalMEURGain, A_MEURGain), 1000)
  })

  it("stake(): Top-up sends out all accumulated REEF and MEUR gains to the staker", async () => { 
    await openTrove({ extraMEURAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraMEURAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MSIC
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A
    await msicToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await msicToken.approve(msicStaking.address, dec(100, 18), {from: A})
    await msicStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await msicToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await msicToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check REEF fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await msicToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await msicToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check REEF fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawMEUR(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check MEUR fee value in event is non-zero
    const emittedMEURFee_1 = toBN(th.getMEURFeeFromMEURBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedMEURFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawMEUR(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check MEUR fee value in event is non-zero
    const emittedMEURFee_2 = toBN(th.getMEURFeeFromMEURBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedMEURFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)
    const expectedTotalMEURGain = emittedMEURFee_1.add(emittedMEURFee_2)

    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_MEURBalance_Before = toBN(await msicToken.balanceOf(A))

    // A tops up
    const GAS_Used = th.gasUsed(await msicStaking.stake(dec(50, 18), {from: A, gasPrice: GAS_PRICE }))

    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_MEURBalance_After = toBN(await msicToken.balanceOf(A))

    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before).add(toBN(GAS_Used * GAS_PRICE))
    const A_MEURGain = A_MEURBalance_After.sub(A_MEURBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalMEURGain, A_MEURGain), 1000)
  })

  it("getPendingETHGain(): Returns the staker's correct pending REEF gain", async () => { 
    await openTrove({ extraMEURAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraMEURAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MSIC
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A
    await msicToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await msicToken.approve(msicStaking.address, dec(100, 18), {from: A})
    await msicStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await msicToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await msicToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check REEF fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await msicToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await msicToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check REEF fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)

    const A_ETHGain = await msicStaking.getPendingETHGain(A)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
  })

  it("getPendingMEURGain(): Returns the staker's correct pending MEUR gain", async () => { 
    await openTrove({ extraMEURAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraMEURAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer MSIC
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A
    await msicToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await msicToken.approve(msicStaking.address, dec(100, 18), {from: A})
    await msicStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await msicToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await msicToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check REEF fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await msicToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await msicToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check REEF fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawMEUR(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check MEUR fee value in event is non-zero
    const emittedMEURFee_1 = toBN(th.getMEURFeeFromMEURBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedMEURFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawMEUR(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check MEUR fee value in event is non-zero
    const emittedMEURFee_2 = toBN(th.getMEURFeeFromMEURBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedMEURFee_2.gt(toBN('0')))

    const expectedTotalMEURGain = emittedMEURFee_1.add(emittedMEURFee_2)
    const A_MEURGain = await msicStaking.getPendingMEURGain(A)

    assert.isAtMost(th.getDifference(expectedTotalMEURGain, A_MEURGain), 1000)
  })

  // - multi depositors, several rewards
  it("MSIC Staking: Multiple stakers earn the correct share of all REEF and MSIC fees, based on their stake size", async () => {
    await openTrove({ extraMEURAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraMEURAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: G } })

    // FF time one year so owner can transfer MSIC
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A, B, C
    await msicToken.transfer(A, dec(100, 18), {from: multisig})
    await msicToken.transfer(B, dec(200, 18), {from: multisig})
    await msicToken.transfer(C, dec(300, 18), {from: multisig})

    // A, B, C make stake
    await msicToken.approve(msicStaking.address, dec(100, 18), {from: A})
    await msicToken.approve(msicStaking.address, dec(200, 18), {from: B})
    await msicToken.approve(msicStaking.address, dec(300, 18), {from: C})
    await msicStaking.stake(dec(100, 18), {from: A})
    await msicStaking.stake(dec(200, 18), {from: B})
    await msicStaking.stake(dec(300, 18), {from: C})

    // Confirm staking contract holds 600 MSIC
    // console.log(`msic staking MSIC bal: ${await msicToken.balanceOf(msicStaking.address)}`)
    assert.equal(await msicToken.balanceOf(msicStaking.address), dec(600, 18))
    assert.equal(await msicStaking.totalMSICStaked(), dec(600, 18))

    // F redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(F, contracts, dec(45, 18), gasPrice = GAS_PRICE)
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

     // G redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(G, contracts, dec(197, 18), gasPrice = GAS_PRICE)
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // F draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawMEUR(th._100pct, dec(104, 18), F, F, {from: F})
    const emittedMEURFee_1 = toBN(th.getMEURFeeFromMEURBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedMEURFee_1.gt(toBN('0')))

    // G draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawMEUR(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedMEURFee_2 = toBN(th.getMEURFeeFromMEURBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedMEURFee_2.gt(toBN('0')))

    // D obtains MSIC from owner and makes a stake
    await msicToken.transfer(D, dec(50, 18), {from: multisig})
    await msicToken.approve(msicStaking.address, dec(50, 18), {from: D})
    await msicStaking.stake(dec(50, 18), {from: D})

    // Confirm staking contract holds 650 MSIC
    assert.equal(await msicToken.balanceOf(msicStaking.address), dec(650, 18))
    assert.equal(await msicStaking.totalMSICStaked(), dec(650, 18))

     // G redeems
     const redemptionTx_3 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(197, 18), gasPrice = GAS_PRICE)
     const emittedETHFee_3 = toBN((await th.getEmittedRedemptionValues(redemptionTx_3))[3])
     assert.isTrue(emittedETHFee_3.gt(toBN('0')))

     // G draws debt
    const borrowingTx_3 = await borrowerOperations.withdrawMEUR(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedMEURFee_3 = toBN(th.getMEURFeeFromMEURBorrowingEvent(borrowingTx_3))
    assert.isTrue(emittedMEURFee_3.gt(toBN('0')))
     
    /*  
    Expected rewards:

    A_ETH: (100* ETHFee_1)/600 + (100* ETHFee_2)/600 + (100*ETH_Fee_3)/650
    B_ETH: (200* ETHFee_1)/600 + (200* ETHFee_2)/600 + (200*ETH_Fee_3)/650
    C_ETH: (300* ETHFee_1)/600 + (300* ETHFee_2)/600 + (300*ETH_Fee_3)/650
    D_ETH:                                             (100*ETH_Fee_3)/650

    A_MEUR: (100*MEURFee_1 )/600 + (100* MEURFee_2)/600 + (100*MEURFee_3)/650
    B_MEUR: (200* MEURFee_1)/600 + (200* MEURFee_2)/600 + (200*MEURFee_3)/650
    C_MEUR: (300* MEURFee_1)/600 + (300* MEURFee_2)/600 + (300*MEURFee_3)/650
    D_MEUR:                                               (100*MEURFee_3)/650
    */

    // Expected REEF gains
    const expectedETHGain_A = toBN('100').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_B = toBN('200').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_C = toBN('300').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_D = toBN('50').mul(emittedETHFee_3).div( toBN('650'))

    // Expected MEUR gains:
    const expectedMEURGain_A = toBN('100').mul(emittedMEURFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedMEURFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedMEURFee_3).div( toBN('650')))

    const expectedMEURGain_B = toBN('200').mul(emittedMEURFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedMEURFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedMEURFee_3).div( toBN('650')))

    const expectedMEURGain_C = toBN('300').mul(emittedMEURFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedMEURFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedMEURFee_3).div( toBN('650')))
    
    const expectedMEURGain_D = toBN('50').mul(emittedMEURFee_3).div( toBN('650'))


    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_MEURBalance_Before = toBN(await msicToken.balanceOf(A))
    const B_ETHBalance_Before = toBN(await web3.eth.getBalance(B))
    const B_MEURBalance_Before = toBN(await msicToken.balanceOf(B))
    const C_ETHBalance_Before = toBN(await web3.eth.getBalance(C))
    const C_MEURBalance_Before = toBN(await msicToken.balanceOf(C))
    const D_ETHBalance_Before = toBN(await web3.eth.getBalance(D))
    const D_MEURBalance_Before = toBN(await msicToken.balanceOf(D))

    // A-D un-stake
    const A_GAS_Used = th.gasUsed(await msicStaking.unstake(dec(100, 18), {from: A, gasPrice: GAS_PRICE }))
    const B_GAS_Used = th.gasUsed(await msicStaking.unstake(dec(200, 18), {from: B, gasPrice: GAS_PRICE }))
    const C_GAS_Used = th.gasUsed(await msicStaking.unstake(dec(400, 18), {from: C, gasPrice: GAS_PRICE }))
    const D_GAS_Used = th.gasUsed(await msicStaking.unstake(dec(50, 18), {from: D, gasPrice: GAS_PRICE }))

    // Confirm all depositors could withdraw

    //Confirm pool Size is now 0
    assert.equal((await msicToken.balanceOf(msicStaking.address)), '0')
    assert.equal((await msicStaking.totalMSICStaked()), '0')

    // Get A-D REEF and MEUR balances
    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_MEURBalance_After = toBN(await msicToken.balanceOf(A))
    const B_ETHBalance_After = toBN(await web3.eth.getBalance(B))
    const B_MEURBalance_After = toBN(await msicToken.balanceOf(B))
    const C_ETHBalance_After = toBN(await web3.eth.getBalance(C))
    const C_MEURBalance_After = toBN(await msicToken.balanceOf(C))
    const D_ETHBalance_After = toBN(await web3.eth.getBalance(D))
    const D_MEURBalance_After = toBN(await msicToken.balanceOf(D))

    // Get REEF and MEUR gains
    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before).add(toBN(A_GAS_Used * GAS_PRICE))
    const A_MEURGain = A_MEURBalance_After.sub(A_MEURBalance_Before)
    const B_ETHGain = B_ETHBalance_After.sub(B_ETHBalance_Before).add(toBN(B_GAS_Used * GAS_PRICE))
    const B_MEURGain = B_MEURBalance_After.sub(B_MEURBalance_Before)
    const C_ETHGain = C_ETHBalance_After.sub(C_ETHBalance_Before).add(toBN(C_GAS_Used * GAS_PRICE))
    const C_MEURGain = C_MEURBalance_After.sub(C_MEURBalance_Before)
    const D_ETHGain = D_ETHBalance_After.sub(D_ETHBalance_Before).add(toBN(D_GAS_Used * GAS_PRICE))
    const D_MEURGain = D_MEURBalance_After.sub(D_MEURBalance_Before)

    // Check gains match expected amounts
    assert.isAtMost(th.getDifference(expectedETHGain_A, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedMEURGain_A, A_MEURGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_B, B_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedMEURGain_B, B_MEURGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_C, C_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedMEURGain_C, C_MEURGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_D, D_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedMEURGain_D, D_MEURGain), 1000)
  })
 
  it("unstake(): reverts if caller has REEF gains and can't receive REEF",  async () => {
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })  
    await openTrove({ extraMEURAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraMEURAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraMEURAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraMEURAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers MSIC to staker A and the non-payable proxy
    await msicToken.transfer(A, dec(100, 18), {from: multisig})
    await msicToken.transfer(nonPayable.address, dec(100, 18), {from: multisig})

    //  A makes stake
    const A_stakeTx = await msicStaking.stake(dec(100, 18), {from: A})
    assert.isTrue(A_stakeTx.receipt.status)

    //  A tells proxy to make a stake
    const proxystakeTxData = await th.getTransactionData('stake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 MSIC
    await nonPayable.forward(msicStaking.address, proxystakeTxData, {from: A})


    // B makes a redemption, creating REEF gain for proxy
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(45, 18), gasPrice = GAS_PRICE)
    
    const proxy_ETHGain = await msicStaking.getPendingETHGain(nonPayable.address)
    assert.isTrue(proxy_ETHGain.gt(toBN('0')))

    // Expect this tx to revert: stake() tries to send nonPayable proxy's accumulated REEF gain (albeit 0),
    //  A tells proxy to unstake
    const proxyUnStakeTxData = await th.getTransactionData('unstake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 MSIC
    const proxyUnstakeTxPromise = nonPayable.forward(msicStaking.address, proxyUnStakeTxData, {from: A})
   
    // but nonPayable proxy can not accept REEF - therefore stake() reverts.
    await assertRevert(proxyUnstakeTxPromise)
  })

  it("receive(): reverts when it receives REEF from an address that is not the Active Pool",  async () => { 
    const ethSendTxPromise1 = web3.eth.sendTransaction({to: msicStaking.address, from: A, value: dec(1, 'ether')})
    const ethSendTxPromise2 = web3.eth.sendTransaction({to: msicStaking.address, from: owner, value: dec(1, 'ether')})

    await assertRevert(ethSendTxPromise1)
    await assertRevert(ethSendTxPromise2)
  })

  it("unstake(): reverts if user has no stake",  async () => {  
    const unstakeTxPromise1 = msicStaking.unstake(1, {from: A})
    const unstakeTxPromise2 = msicStaking.unstake(1, {from: owner})

    await assertRevert(unstakeTxPromise1)
    await assertRevert(unstakeTxPromise2)
  })

  it('Test requireCallerIsTroveManager', async () => {
    const msicStakingTester = await MSICStakingTester.new()
    await assertRevert(msicStakingTester.requireCallerIsTroveManager(), 'MSICStaking: caller is not TroveM')
  })
})
