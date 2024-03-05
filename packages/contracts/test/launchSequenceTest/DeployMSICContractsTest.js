const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")


const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const assertRevert = th.assertRevert
const toBN = th.toBN
const dec = th.dec

contract('Deploying the MSIC contracts: LCF, CI, MSICStaking, and MSICToken ', async accounts => {
  const [mosaicAG, A, B] = accounts;
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let MSICContracts

  const oneMillion = toBN(1000000)
  const digits = toBN(1e18)
  const thirtyTwo = toBN(32)
  const expectedCISupplyCap = thirtyTwo.mul(oneMillion).mul(digits)

  beforeEach(async () => {
    // Deploy all contracts from the first account
    MSICContracts = await deploymentHelper.deployMSICContracts(bountyAddress, lpRewardsAddress, multisig)
    await deploymentHelper.connectMSICContracts(MSICContracts)

    msicStaking = MSICContracts.msicStaking
    msicToken = MSICContracts.msicToken
    communityIssuance = MSICContracts.communityIssuance
    lockupContractFactory = MSICContracts.lockupContractFactory

    //MSIC Staking and CommunityIssuance have not yet had their setters called, so are not yet
    // connected to the rest of the system
  })


  describe('CommunityIssuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(mosaicAG, storedDeployerAddress)
    })
  })

  describe('MSICStaking deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await msicStaking.owner()

      assert.equal(mosaicAG, storedDeployerAddress)
    })
  })

  describe('MSICToken deployment', async accounts => {
    it("Stores the multisig's address", async () => {
      const storedMultisigAddress = await msicToken.multisigAddress()

      assert.equal(multisig, storedMultisigAddress)
    })

    it("Stores the CommunityIssuance address", async () => {
      const storedCIAddress = await msicToken.communityIssuanceAddress()

      assert.equal(communityIssuance.address, storedCIAddress)
    })

    it("Stores the LockupContractFactory address", async () => {
      const storedLCFAddress = await msicToken.lockupContractFactory()

      assert.equal(lockupContractFactory.address, storedLCFAddress)
    })

    it("Mints the correct MSIC amount to the multisig's address: (64.66 million)", async () => {
      const multisigMSICEntitlement = await msicToken.balanceOf(multisig)

     const twentyThreeSixes = "6".repeat(23)
      const expectedMultisigEntitlement = "64".concat(twentyThreeSixes).concat("7")
      assert.equal(multisigMSICEntitlement, expectedMultisigEntitlement)
    })

    it("Mints the correct MSIC amount to the CommunityIssuance contract address: 32 million", async () => {
      const communityMSICEntitlement = await msicToken.balanceOf(communityIssuance.address)
      // 32 million as 18-digit decimal
      const _32Million = dec(32, 24)

      assert.equal(communityMSICEntitlement, _32Million)
    })

    it("Mints the correct MSIC amount to the bountyAddress EOA: 2 million", async () => {
      const bountyAddressBal = await msicToken.balanceOf(bountyAddress)
      // 2 million as 18-digit decimal
      const _2Million = dec(2, 24)

      assert.equal(bountyAddressBal, _2Million)
    })

    it("Mints the correct MSIC amount to the lpRewardsAddress EOA: 1.33 million", async () => {
      const lpRewardsAddressBal = await msicToken.balanceOf(lpRewardsAddress)
      // 1.3 million as 18-digit decimal
      const _1pt33Million = "1".concat("3".repeat(24))

      assert.equal(lpRewardsAddressBal, _1pt33Million)
    })
  })

  describe('Community Issuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {

      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(storedDeployerAddress, mosaicAG)
    })

    it("Has a supply cap of 32 million", async () => {
      const supplyCap = await communityIssuance.MSICSupplyCap()

      assert.isTrue(expectedCISupplyCap.eq(supplyCap))
    })

    it("Mosaic AG can set addresses if CI's MSIC balance is equal or greater than 32 million ", async () => {
      const MSICBalance = await msicToken.balanceOf(communityIssuance.address)
      assert.isTrue(MSICBalance.eq(expectedCISupplyCap))

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployMosaicCore()

      const tx = await communityIssuance.setAddresses(
        msicToken.address,
        coreContracts.stabilityPool.address,
        { from: mosaicAG }
      );
      assert.isTrue(tx.receipt.status)
    })

    it("Mosaic AG can't set addresses if CI's MSIC balance is < 32 million ", async () => {
      const newCI = await CommunityIssuance.new()

      const MSICBalance = await msicToken.balanceOf(newCI.address)
      assert.equal(MSICBalance, '0')

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployMosaicCore()

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await msicToken.transfer(newCI.address, '31999999999999999999999999', {from: multisig}) // 1e-18 less than CI expects (32 million)

      try {
        const tx = await newCI.setAddresses(
          msicToken.address,
          coreContracts.stabilityPool.address,
          { from: mosaicAG }
        );
      
        // Check it gives the expected error message for a failed Solidity 'assert'
      } catch (err) {
        assert.include(err.message, "invalid opcode")
      }
    })
  })

  describe('Connecting MSICToken to LCF, CI and MSICStaking', async accounts => {
    it('sets the correct MSICToken address in MSICStaking', async () => {
      // Deploy core contracts and set the MSICToken address in the CI and MSICStaking
      const coreContracts = await deploymentHelper.deployMosaicCore()
      await deploymentHelper.connectMSICContractsToCore(MSICContracts, coreContracts)

      const msicTokenAddress = msicToken.address

      const recordedMSICTokenAddress = await msicStaking.msicToken()
      assert.equal(msicTokenAddress, recordedMSICTokenAddress)
    })

    it('sets the correct MSICToken address in LockupContractFactory', async () => {
      const msicTokenAddress = msicToken.address

      const recordedMSICTokenAddress = await lockupContractFactory.msicTokenAddress()
      assert.equal(msicTokenAddress, recordedMSICTokenAddress)
    })

    it('sets the correct MSICToken address in CommunityIssuance', async () => {
      // Deploy core contracts and set the MSICToken address in the CI and MSICStaking
      const coreContracts = await deploymentHelper.deployMosaicCore()
      await deploymentHelper.connectMSICContractsToCore(MSICContracts, coreContracts)

      const msicTokenAddress = msicToken.address

      const recordedMSICTokenAddress = await communityIssuance.msicToken()
      assert.equal(msicTokenAddress, recordedMSICTokenAddress)
    })
  })
})
