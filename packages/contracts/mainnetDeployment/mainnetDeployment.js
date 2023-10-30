const { UniswapV2Factory } = require("./ABIs/UniswapV2Factory.js")
const { UniswapV2Pair } = require("./ABIs/UniswapV2Pair.js")
const { UniswapV2Router02 } = require("./ABIs/UniswapV2Router02.js")
const { ChainlinkAggregatorV3Interface } = require("./ABIs/ChainlinkAggregatorV3Interface.js")
const { TestHelper: th, TimeValues: timeVals } = require("../utils/testHelpers.js")
const { dec } = th
const MainnetDeploymentHelper = require("../utils/mainnetDeploymentHelpers.js")
const toBigNum = ethers.BigNumber.from

async function mainnetDeploy(configParams) {
  const date = new Date()
  console.log(date.toUTCString())
  const deployerWallet = (await ethers.getSigners())[0]
  // const account2Wallet = (await ethers.getSigners())[1]
  const mdh = new MainnetDeploymentHelper(configParams, deployerWallet)
  const gasPrice = configParams.GAS_PRICE

  const deploymentState = mdh.loadPreviousDeployment()

  console.log(`deployer address: ${deployerWallet.address}`)
  assert.equal(deployerWallet.address, configParams.mosaicAddrs.DEPLOYER)
  // assert.equal(account2Wallet.address, configParams.beneficiaries.ACCOUNT_2)
  let deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
  console.log(`deployerETHBalance before: ${deployerETHBalance}`)

  // Get UniswapV2Factory instance at its deployed address
  const uniswapV2Factory = new ethers.Contract(
    configParams.externalAddrs.UNISWAP_V2_FACTORY,
    UniswapV2Factory.abi,
    deployerWallet
  )

  console.log(`Uniswp addr: ${uniswapV2Factory.address}`)
  const uniAllPairsLength = await uniswapV2Factory.allPairsLength()
  console.log(`Uniswap Factory number of pairs: ${uniAllPairsLength}`)

  deployerETHBalance = await ethers.provider.getBalance(deployerWallet.address)
  console.log(`deployer's REEF balance before deployments: ${deployerETHBalance}`)

  // Deploy core logic contracts
  const mosaicCore = await mdh.deployMosaicCoreMainnet(configParams.externalAddrs.TELLOR_MASTER, deploymentState)
  await mdh.logContractObjects(mosaicCore)

  // Check Uniswap Pair MoUSD-REEF pair before pair creation
  let MoUSDWETHPairAddr = await uniswapV2Factory.getPair(mosaicCore.msicToken.address, configParams.externalAddrs.WETH_ERC20)
  let WETHMoUSDPairAddr = await uniswapV2Factory.getPair(configParams.externalAddrs.WETH_ERC20, mosaicCore.msicToken.address)
  assert.equal(MoUSDWETHPairAddr, WETHMoUSDPairAddr)


  if (MoUSDWETHPairAddr == th.ZERO_ADDRESS) {
    // Deploy Unipool for MoUSD-WETH
    await mdh.sendAndWaitForTransaction(uniswapV2Factory.createPair(
      configParams.externalAddrs.WETH_ERC20,
      mosaicCore.msicToken.address,
      { gasPrice }
    ))

    // Check Uniswap Pair MoUSD-WETH pair after pair creation (forwards and backwards should have same address)
    MoUSDWETHPairAddr = await uniswapV2Factory.getPair(mosaicCore.msicToken.address, configParams.externalAddrs.WETH_ERC20)
    assert.notEqual(MoUSDWETHPairAddr, th.ZERO_ADDRESS)
    WETHMoUSDPairAddr = await uniswapV2Factory.getPair(configParams.externalAddrs.WETH_ERC20, mosaicCore.msicToken.address)
    console.log(`MoUSD-WETH pair contract address after Uniswap pair creation: ${MoUSDWETHPairAddr}`)
    assert.equal(WETHMoUSDPairAddr, MoUSDWETHPairAddr)
  }

  // Deploy Unipool
  const unipool = await mdh.deployUnipoolMainnet(deploymentState)

  // Deploy MSIC Contracts
  const MSICContracts = await mdh.deployMSICContractsMainnet(
    configParams.mosaicAddrs.GENERAL_SAFE, // bounty address
    unipool.address,  // lp rewards address
    configParams.mosaicAddrs.MSIC_SAFE, // multisig MSIC endowment address
    deploymentState,
  )

  // Connect all core contracts up
  await mdh.connectCoreContractsMainnet(mosaicCore, MSICContracts, configParams.externalAddrs.CHAINLINK_ETHUSD_PROXY)
  await mdh.connectMSICContractsMainnet(MSICContracts)
  await mdh.connectMSICContractsToCoreMainnet(MSICContracts, mosaicCore)

  // Deploy a read-only multi-trove getter
  const multiTroveGetter = await mdh.deployMultiTroveGetterMainnet(mosaicCore, deploymentState)

  // Connect Unipool to MSICToken and the MoUSD-WETH pair address, with a 6 week duration
  const LPRewardsDuration = timeVals.SECONDS_IN_SIX_WEEKS
  await mdh.connectUnipoolMainnet(unipool, MSICContracts, MoUSDWETHPairAddr, LPRewardsDuration)

  // Log MSIC and Unipool addresses
  await mdh.logContractObjects(MSICContracts)
  console.log(`Unipool address: ${unipool.address}`)
  
  // let latestBlock = await ethers.provider.getBlockNumber()
  let deploymentStartTime = await MSICContracts.msicToken.getDeploymentStartTime()

  console.log(`deployment start time: ${deploymentStartTime}`)
  const oneYearFromDeployment = (Number(deploymentStartTime) + timeVals.SECONDS_IN_ONE_YEAR).toString()
  console.log(`time oneYearFromDeployment: ${oneYearFromDeployment}`)

  // Deploy LockupContracts - one for each beneficiary
  const lockupContracts = {}

  for (const [investor, investorAddr] of Object.entries(configParams.beneficiaries)) {
    const lockupContractEthersFactory = await ethers.getContractFactory("LockupContract", deployerWallet)
    if (deploymentState[investor] && deploymentState[investor].address) {
      console.log(`Using previously deployed ${investor} lockup contract at address ${deploymentState[investor].address}`)
      lockupContracts[investor] = new ethers.Contract(
        deploymentState[investor].address,
        lockupContractEthersFactory.interface,
        deployerWallet
      )
    } else {
      const txReceipt = await mdh.sendAndWaitForTransaction(MSICContracts.lockupContractFactory.deployLockupContract(investorAddr, oneYearFromDeployment, { gasPrice }))

      const address = await txReceipt.logs[0].address // The deployment event emitted from the LC itself is is the first of two events, so this is its address 
      lockupContracts[investor] = new ethers.Contract(
        address,
        lockupContractEthersFactory.interface,
        deployerWallet
      )

      deploymentState[investor] = {
        address: address,
        txHash: txReceipt.transactionHash
      }

      mdh.saveDeployment(deploymentState)
    }

    const msicTokenAddr = MSICContracts.msicToken.address
    // verify
    if (configParams.ETHERSCAN_BASE_URL) {
      await mdh.verifyContract(investor, deploymentState, [msicTokenAddr, investorAddr, oneYearFromDeployment])
    }
  }

  // // --- TESTS AND CHECKS  ---

  // Deployer repay MoUSD
  // console.log(`deployer trove debt before repaying: ${await mosaicCore.troveManager.getTroveDebt(deployerWallet.address)}`)
 // await mdh.sendAndWaitForTransaction(mosaicCore.borrowerOperations.repayMoUSD(dec(800, 18), th.ZERO_ADDRESS, th.ZERO_ADDRESS, {gasPrice, gasLimit: 1000000}))
  // console.log(`deployer trove debt after repaying: ${await mosaicCore.troveManager.getTroveDebt(deployerWallet.address)}`)
  
  // Deployer add coll
  // console.log(`deployer trove coll before adding coll: ${await mosaicCore.troveManager.getTroveColl(deployerWallet.address)}`)
  // await mdh.sendAndWaitForTransaction(mosaicCore.borrowerOperations.addColl(th.ZERO_ADDRESS, th.ZERO_ADDRESS, {value: dec(2, 'ether'), gasPrice, gasLimit: 1000000}))
  // console.log(`deployer trove coll after addingColl: ${await mosaicCore.troveManager.getTroveColl(deployerWallet.address)}`)
  
  // Check chainlink proxy price ---

  const chainlinkProxy = new ethers.Contract(
    configParams.externalAddrs.CHAINLINK_ETHUSD_PROXY,
    ChainlinkAggregatorV3Interface,
    deployerWallet
  )

  // Get latest price
  let chainlinkPrice = await chainlinkProxy.latestAnswer()
  console.log(`current Chainlink price: ${chainlinkPrice}`)

  // Check Tellor price directly (through our TellorCaller)
  let tellorPriceResponse = await mosaicCore.tellorCaller.getTellorCurrentValue(1) // id == 1: the REEF-USD request ID
  console.log(`current Tellor price: ${tellorPriceResponse[1]}`)
  console.log(`current Tellor timestamp: ${tellorPriceResponse[2]}`)

  // // --- Lockup Contracts ---
  console.log("LOCKUP CONTRACT CHECKS")
  // Check lockup contracts exist for each beneficiary with correct unlock time
  for (investor of Object.keys(lockupContracts)) {
    const lockupContract = lockupContracts[investor]
    // check LC references correct MSICToken 
    const storedMSICTokenAddr = await lockupContract.msicToken()
    assert.equal(MSICContracts.msicToken.address, storedMSICTokenAddr)
    // Check contract has stored correct beneficary
    const onChainBeneficiary = await lockupContract.beneficiary()
    assert.equal(configParams.beneficiaries[investor].toLowerCase(), onChainBeneficiary.toLowerCase())
    // Check correct unlock time (1 yr from deployment)
    const unlockTime = await lockupContract.unlockTime()
    assert.equal(oneYearFromDeployment, unlockTime)

    console.log(
      `lockupContract addr: ${lockupContract.address},
            stored MSICToken addr: ${storedMSICTokenAddr}
            beneficiary: ${investor},
            beneficiary addr: ${configParams.beneficiaries[investor]},
            on-chain beneficiary addr: ${onChainBeneficiary},
            unlockTime: ${unlockTime}
            `
    )
  }

  // // --- Check correct addresses set in MSICToken
  // console.log("STORED ADDRESSES IN MSIC TOKEN")
  // const storedMultisigAddress = await MSICContracts.msicToken.multisigAddress()
  // assert.equal(configParams.mosaicAddrs.MSIC_SAFE.toLowerCase(), storedMultisigAddress.toLowerCase())
  // console.log(`multi-sig address stored in MSICToken : ${th.squeezeAddr(storedMultisigAddress)}`)
  // console.log(`MSIC Safe address: ${th.squeezeAddr(configParams.mosaicAddrs.MSIC_SAFE)}`)

  // // --- MSIC allowances of different addresses ---
  // console.log("INITIAL MSIC BALANCES")
  // // Unipool
  // const unipoolMSICBal = await MSICContracts.msicToken.balanceOf(unipool.address)
  // // assert.equal(unipoolMSICBal.toString(), '1333333333333333333333333')
  // th.logBN('Unipool MSIC balance       ', unipoolMSICBal)

  // // MSIC Safe
  // const msicSafeBal = await MSICContracts.msicToken.balanceOf(configParams.mosaicAddrs.MSIC_SAFE)
  // assert.equal(msicSafeBal.toString(), '64666666666666666666666667')
  // th.logBN('MSIC Safe balance     ', msicSafeBal)

  // // Bounties/hackathons (General Safe)
  // const generalSafeBal = await MSICContracts.msicToken.balanceOf(configParams.mosaicAddrs.GENERAL_SAFE)
  // assert.equal(generalSafeBal.toString(), '2000000000000000000000000')
  // th.logBN('General Safe balance       ', generalSafeBal)

  // // CommunityIssuance contract
  // const communityIssuanceBal = await MSICContracts.msicToken.balanceOf(MSICContracts.communityIssuance.address)
  // // assert.equal(communityIssuanceBal.toString(), '32000000000000000000000000')
  // th.logBN('Community Issuance balance', communityIssuanceBal)

  // // --- PriceFeed ---
  // console.log("PRICEFEED CHECKS")
  // // Check Pricefeed's status and last good price
  // const lastGoodPrice = await mosaicCore.priceFeed.lastGoodPrice()
  // const priceFeedInitialStatus = await mosaicCore.priceFeed.status()
  // th.logBN('PriceFeed first stored price', lastGoodPrice)
  // console.log(`PriceFeed initial status: ${priceFeedInitialStatus}`)

  // // Check PriceFeed's & TellorCaller's stored addresses
  // const priceFeedCLAddress = await mosaicCore.priceFeed.priceAggregator()
  // const priceFeedTellorCallerAddress = await mosaicCore.priceFeed.tellorCaller()
  // assert.equal(priceFeedCLAddress, configParams.externalAddrs.CHAINLINK_ETHUSD_PROXY)
  // assert.equal(priceFeedTellorCallerAddress, mosaicCore.tellorCaller.address)

  // // Check Tellor address
  // const tellorCallerTellorMasterAddress = await mosaicCore.tellorCaller.tellor()
  // assert.equal(tellorCallerTellorMasterAddress, configParams.externalAddrs.TELLOR_MASTER)

  // // --- Unipool ---

  // // Check Unipool's MoUSD-REEF Uniswap Pair address
  // const unipoolUniswapPairAddr = await unipool.uniToken()
  // console.log(`Unipool's stored MoUSD-REEF Uniswap Pair address: ${unipoolUniswapPairAddr}`)

  // console.log("SYSTEM GLOBAL VARS CHECKS")
  // // --- Sorted Troves ---

  // // Check max size
  // const sortedTrovesMaxSize = (await mosaicCore.sortedTroves.data())[2]
  // assert.equal(sortedTrovesMaxSize, '115792089237316195423570985008687907853269984665640564039457584007913129639935')

  // // --- TroveManager ---

  // const liqReserve = await mosaicCore.troveManager.MoUSD_GAS_COMPENSATION()
  // const minNetDebt = await mosaicCore.troveManager.MIN_NET_DEBT()

  // th.logBN('system liquidation reserve', liqReserve)
  // th.logBN('system min net debt      ', minNetDebt)

  // // --- Make first MoUSD-REEF liquidity provision ---

  // // Open trove if not yet opened
  // const troveStatus = await mosaicCore.troveManager.getTroveStatus(deployerWallet.address)
  // if (troveStatus.toString() != '1') {
  //   let _3kMoUSDWithdrawal = th.dec(3000, 18) // 3000 MoUSD
  //   let _3ETHcoll = th.dec(3, 'ether') // 3 REEF
  //   console.log('Opening trove...')
  //   await mdh.sendAndWaitForTransaction(
  //     mosaicCore.borrowerOperations.openTrove(
  //       th._100pct,
  //       _3kMoUSDWithdrawal,
  //       th.ZERO_ADDRESS,
  //       th.ZERO_ADDRESS,
  //       { value: _3ETHcoll, gasPrice }
  //     )
  //   )
  // } else {
  //   console.log('Deployer already has an active trove')
  // }

  // // Check deployer now has an open trove
  // console.log(`deployer is in sorted list after making trove: ${await mosaicCore.sortedTroves.contains(deployerWallet.address)}`)

  // const deployerTrove = await mosaicCore.troveManager.Troves(deployerWallet.address)
  // th.logBN('deployer debt', deployerTrove[0])
  // th.logBN('deployer coll', deployerTrove[1])
  // th.logBN('deployer stake', deployerTrove[2])
  // console.log(`deployer's trove status: ${deployerTrove[3]}`)

  // // Check deployer has MoUSD
  // let deployerMoUSDBal = await mosaicCore.msicToken.balanceOf(deployerWallet.address)
  // th.logBN("deployer's MoUSD balance", deployerMoUSDBal)

  // // Check Uniswap pool has MoUSD and WETH tokens
  const MoUSDETHPair = await new ethers.Contract(
    MoUSDWETHPairAddr,
    UniswapV2Pair.abi,
    deployerWallet
  )

  // const token0Addr = await MoUSDETHPair.token0()
  // const token1Addr = await MoUSDETHPair.token1()
  // console.log(`MoUSD-REEF Pair token 0: ${th.squeezeAddr(token0Addr)},
  //       MoUSDToken contract addr: ${th.squeezeAddr(mosaicCore.msicToken.address)}`)
  // console.log(`MoUSD-REEF Pair token 1: ${th.squeezeAddr(token1Addr)},
  //       WETH ERC20 contract addr: ${th.squeezeAddr(configParams.externalAddrs.WETH_ERC20)}`)

  // // Check initial MoUSD-REEF pair reserves before provision
  // let reserves = await MoUSDETHPair.getReserves()
  // th.logBN("MoUSD-REEF Pair's MoUSD reserves before provision", reserves[0])
  // th.logBN("MoUSD-REEF Pair's REEF reserves before provision", reserves[1])

  // // Get the UniswapV2Router contract
  // const uniswapV2Router02 = new ethers.Contract(
  //   configParams.externalAddrs.UNISWAP_V2_ROUTER02,
  //   UniswapV2Router02.abi,
  //   deployerWallet
  // )

  // // --- Provide liquidity to MoUSD-REEF pair if not yet done so ---
  // let deployerLPTokenBal = await MoUSDETHPair.balanceOf(deployerWallet.address)
  // if (deployerLPTokenBal.toString() == '0') {
  //   console.log('Providing liquidity to Uniswap...')
  //   // Give router an allowance for MoUSD
  //   await mosaicCore.msicToken.increaseAllowance(uniswapV2Router02.address, dec(10000, 18))

  //   // Check Router's spending allowance
  //   const routerMoUSDAllowanceFromDeployer = await mosaicCore.msicToken.allowance(deployerWallet.address, uniswapV2Router02.address)
  //   th.logBN("router's spending allowance for deployer's MoUSD", routerMoUSDAllowanceFromDeployer)

  //   // Get amounts for liquidity provision
  //   const LP_ETH = dec(1, 'ether')

  //   // Convert 8-digit CL price to 18 and multiply by REEF amount
  //   const MoUSDAmount = toBigNum(chainlinkPrice)
  //     .mul(toBigNum(dec(1, 10)))
  //     .mul(toBigNum(LP_ETH))
  //     .div(toBigNum(dec(1, 18)))

  //   const minMoUSDAmount = MoUSDAmount.sub(toBigNum(dec(100, 18)))

  //   latestBlock = await ethers.provider.getBlockNumber()
  //   now = (await ethers.provider.getBlock(latestBlock)).timestamp
  //   let tenMinsFromNow = now + (60 * 60 * 10)

  //   // Provide liquidity to MoUSD-REEF pair
  //   await mdh.sendAndWaitForTransaction(
  //     uniswapV2Router02.addLiquidityETH(
  //       mosaicCore.msicToken.address, // address of MoUSD token
  //       MoUSDAmount, // MoUSD provision
  //       minMoUSDAmount, // minimum MoUSD provision
  //       LP_ETH, // minimum REEF provision
  //       deployerWallet.address, // address to send LP tokens to
  //       tenMinsFromNow, // deadline for this tx
  //       {
  //         value: dec(1, 'ether'),
  //         gasPrice,
  //         gasLimit: 5000000 // For some reason, ethers can't estimate gas for this tx
  //       }
  //     )
  //   )
  // } else {
  //   console.log('Liquidity already provided to Uniswap')
  // }
  // // Check MoUSD-REEF reserves after liquidity provision:
  // reserves = await MoUSDETHPair.getReserves()
  // th.logBN("MoUSD-REEF Pair's MoUSD reserves after provision", reserves[0])
  // th.logBN("MoUSD-REEF Pair's REEF reserves after provision", reserves[1])



  // // ---  Check LP staking  ---
  // console.log("CHECK LP STAKING EARNS MSIC")

  // // Check deployer's LP tokens
  // deployerLPTokenBal = await MoUSDETHPair.balanceOf(deployerWallet.address)
  // th.logBN("deployer's LP token balance", deployerLPTokenBal)

  // // Stake LP tokens in Unipool
  // console.log(`MoUSDETHPair addr: ${MoUSDETHPair.address}`)
  // console.log(`Pair addr stored in Unipool: ${await unipool.uniToken()}`)

  // earnedMSIC = await unipool.earned(deployerWallet.address)
  // th.logBN("deployer's farmed MSIC before staking LP tokens", earnedMSIC)

  // const deployerUnipoolStake = await unipool.balanceOf(deployerWallet.address)
  // if (deployerUnipoolStake.toString() == '0') {
  //   console.log('Staking to Unipool...')
  //   // Deployer approves Unipool
  //   await mdh.sendAndWaitForTransaction(
  //     MoUSDETHPair.approve(unipool.address, deployerLPTokenBal, { gasPrice })
  //   )

  //   await mdh.sendAndWaitForTransaction(unipool.stake(1, { gasPrice }))
  // } else {
  //   console.log('Already staked in Unipool')
  // }

  // console.log("wait 90 seconds before checking earnings... ")
  // await configParams.waitFunction()

  // earnedMSIC = await unipool.earned(deployerWallet.address)
  // th.logBN("deployer's farmed MSIC from Unipool after waiting ~1.5mins", earnedMSIC)

  // let deployerMSICBal = await MSICContracts.msicToken.balanceOf(deployerWallet.address)
  // th.logBN("deployer MSIC Balance Before SP deposit", deployerMSICBal)



  // // --- Make SP deposit and earn MSIC ---
  // console.log("CHECK DEPLOYER MAKING DEPOSIT AND EARNING MSIC")

  // let SPDeposit = await mosaicCore.stabilityPool.getCompoundedMoUSDDeposit(deployerWallet.address)
  // th.logBN("deployer SP deposit before making deposit", SPDeposit)

  // // Provide to SP
  // await mdh.sendAndWaitForTransaction(mosaicCore.stabilityPool.provideToSP(dec(15, 18), th.ZERO_ADDRESS, { gasPrice, gasLimit: 400000 }))

  // // Get SP deposit 
  // SPDeposit = await mosaicCore.stabilityPool.getCompoundedMoUSDDeposit(deployerWallet.address)
  // th.logBN("deployer SP deposit after depositing 15 MoUSD", SPDeposit)

  // console.log("wait 90 seconds before withdrawing...")
  // // wait 90 seconds
  // await configParams.waitFunction()

  // // Withdraw from SP
  // // await mdh.sendAndWaitForTransaction(mosaicCore.stabilityPool.withdrawFromSP(dec(1000, 18), { gasPrice, gasLimit: 400000 }))

  // // SPDeposit = await mosaicCore.stabilityPool.getCompoundedMoUSDDeposit(deployerWallet.address)
  // // th.logBN("deployer SP deposit after full withdrawal", SPDeposit)

  // // deployerMSICBal = await MSICContracts.msicToken.balanceOf(deployerWallet.address)
  // // th.logBN("deployer MSIC Balance after SP deposit withdrawal", deployerMSICBal)



  // // ---  Attempt withdrawal from LC  ---
  // console.log("CHECK BENEFICIARY ATTEMPTING WITHDRAWAL FROM LC")

  // // connect Acct2 wallet to the LC they are beneficiary of
  // let account2LockupContract = await lockupContracts["ACCOUNT_2"].connect(account2Wallet)

  // // Deployer funds LC with 10 MSIC
  // // await mdh.sendAndWaitForTransaction(MSICContracts.msicToken.transfer(account2LockupContract.address, dec(10, 18), { gasPrice }))

  // // account2 MSIC bal
  // let account2bal = await MSICContracts.msicToken.balanceOf(account2Wallet.address)
  // th.logBN("account2 MSIC bal before withdrawal attempt", account2bal)

  // // Check LC MSIC bal 
  // let account2LockupContractBal = await MSICContracts.msicToken.balanceOf(account2LockupContract.address)
  // th.logBN("account2's LC MSIC bal before withdrawal attempt", account2LockupContractBal)

  // // Acct2 attempts withdrawal from  LC
  // await mdh.sendAndWaitForTransaction(account2LockupContract.withdrawMSIC({ gasPrice, gasLimit: 1000000 }))

  // // Acct MSIC bal
  // account2bal = await MSICContracts.msicToken.balanceOf(account2Wallet.address)
  // th.logBN("account2's MSIC bal after LC withdrawal attempt", account2bal)

  // // Check LC bal 
  // account2LockupContractBal = await MSICContracts.msicToken.balanceOf(account2LockupContract.address)
  // th.logBN("account2's LC MSIC bal LC withdrawal attempt", account2LockupContractBal)

  // // --- Stake MSIC ---
  // console.log("CHECK DEPLOYER STAKING MSIC")

  // // Log deployer MSIC bal and stake before staking
  // deployerMSICBal = await MSICContracts.msicToken.balanceOf(deployerWallet.address)
  // th.logBN("deployer MSIC bal before staking", deployerMSICBal)
  // let deployerMSICStake = await MSICContracts.msicStaking.stakes(deployerWallet.address)
  // th.logBN("deployer stake before staking", deployerMSICStake)

  // // stake 13 MSIC
  // await mdh.sendAndWaitForTransaction(MSICContracts.msicStaking.stake(dec(13, 18), { gasPrice, gasLimit: 1000000 }))

  // // Log deployer MSIC bal and stake after staking
  // deployerMSICBal = await MSICContracts.msicToken.balanceOf(deployerWallet.address)
  // th.logBN("deployer MSIC bal after staking", deployerMSICBal)
  // deployerMSICStake = await MSICContracts.msicStaking.stakes(deployerWallet.address)
  // th.logBN("deployer stake after staking", deployerMSICStake)

  // // Log deployer rev share immediately after staking
  // let deployerMoUSDRevShare = await MSICContracts.msicStaking.getPendingMoUSDGain(deployerWallet.address)
  // th.logBN("deployer pending MoUSD revenue share", deployerMoUSDRevShare)



  // // --- 2nd Account opens trove ---
  // const trove2Status = await mosaicCore.troveManager.getTroveStatus(account2Wallet.address)
  // if (trove2Status.toString() != '1') {
  //   console.log("Acct 2 opens a trove ...")
  //   let _2kMoUSDWithdrawal = th.dec(2000, 18) // 2000 MoUSD
  //   let _1pt5_ETHcoll = th.dec(15, 17) // 1.5 REEF
  //   const borrowerOpsEthersFactory = await ethers.getContractFactory("BorrowerOperations", account2Wallet)
  //   const borrowerOpsAcct2 = await new ethers.Contract(mosaicCore.borrowerOperations.address, borrowerOpsEthersFactory.interface, account2Wallet)

  //   await mdh.sendAndWaitForTransaction(borrowerOpsAcct2.openTrove(th._100pct, _2kMoUSDWithdrawal, th.ZERO_ADDRESS, th.ZERO_ADDRESS, { value: _1pt5_ETHcoll, gasPrice, gasLimit: 1000000 }))
  // } else {
  //   console.log('Acct 2 already has an active trove')
  // }

  // const acct2Trove = await mosaicCore.troveManager.Troves(account2Wallet.address)
  // th.logBN('acct2 debt', acct2Trove[0])
  // th.logBN('acct2 coll', acct2Trove[1])
  // th.logBN('acct2 stake', acct2Trove[2])
  // console.log(`acct2 trove status: ${acct2Trove[3]}`)

  // // Log deployer's pending MoUSD gain - check fees went to staker (deloyer)
  // deployerMoUSDRevShare = await MSICContracts.msicStaking.getPendingMoUSDGain(deployerWallet.address)
  // th.logBN("deployer pending MoUSD revenue share from staking, after acct 2 opened trove", deployerMoUSDRevShare)

  // //  --- deployer withdraws staking gains ---
  // console.log("CHECK DEPLOYER WITHDRAWING STAKING GAINS")

  // // check deployer's MoUSD balance before withdrawing staking gains
  // deployerMoUSDBal = await mosaicCore.msicToken.balanceOf(deployerWallet.address)
  // th.logBN('deployer MoUSD bal before withdrawing staking gains', deployerMoUSDBal)

  // // Deployer withdraws staking gains
  // await mdh.sendAndWaitForTransaction(MSICContracts.msicStaking.unstake(0, { gasPrice, gasLimit: 1000000 }))

  // // check deployer's MoUSD balance after withdrawing staking gains
  // deployerMoUSDBal = await mosaicCore.msicToken.balanceOf(deployerWallet.address)
  // th.logBN('deployer MoUSD bal after withdrawing staking gains', deployerMoUSDBal)


  // // --- System stats  ---

  // Uniswap MoUSD-REEF pool size
  reserves = await MoUSDETHPair.getReserves()
  th.logBN("MoUSD-REEF Pair's current MoUSD reserves", reserves[0])
  th.logBN("MoUSD-REEF Pair's current REEF reserves", reserves[1])

  // Number of troves
  const numTroves = await mosaicCore.troveManager.getTroveOwnersCount()
  console.log(`number of troves: ${numTroves} `)

  // Sorted list size
  const listSize = await mosaicCore.sortedTroves.getSize()
  console.log(`Trove list size: ${listSize} `)

  // Total system debt and coll
  const entireSystemDebt = await mosaicCore.troveManager.getEntireSystemDebt()
  const entireSystemColl = await mosaicCore.troveManager.getEntireSystemColl()
  th.logBN("Entire system debt", entireSystemDebt)
  th.logBN("Entire system coll", entireSystemColl)
  
  // TCR
  const TCR = await mosaicCore.troveManager.getTCR(chainlinkPrice)
  console.log(`TCR: ${TCR}`)

  // current borrowing rate
  const baseRate = await mosaicCore.troveManager.baseRate()
  const currentBorrowingRate = await mosaicCore.troveManager.getBorrowingRateWithDecay()
  th.logBN("Base rate", baseRate)
  th.logBN("Current borrowing rate", currentBorrowingRate)

  // total SP deposits
  const totalSPDeposits = await mosaicCore.stabilityPool.getTotalMoUSDDeposits()
  th.logBN("Total MoUSD SP deposits", totalSPDeposits)

  // total MSIC Staked in MSICStaking
  const totalMSICStaked = await MSICContracts.msicStaking.totalMSICStaked()
  th.logBN("Total MSIC staked", totalMSICStaked)

  // total LP tokens staked in Unipool
  const totalLPTokensStaked = await unipool.totalSupply()
  th.logBN("Total LP (MoUSD-REEF) tokens staked in unipool", totalLPTokensStaked)

  // --- State variables ---

  // TroveManager 
  console.log("TroveManager state variables:")
  const totalStakes = await mosaicCore.troveManager.totalStakes()
  const totalStakesSnapshot = await mosaicCore.troveManager.totalStakesSnapshot()
  const totalCollateralSnapshot = await mosaicCore.troveManager.totalCollateralSnapshot()
  th.logBN("Total trove stakes", totalStakes)
  th.logBN("Snapshot of total trove stakes before last liq. ", totalStakesSnapshot)
  th.logBN("Snapshot of total trove collateral before last liq. ", totalCollateralSnapshot)

  const L_ETH = await mosaicCore.troveManager.L_ETH()
  const L_MoUSDDebt = await mosaicCore.troveManager.L_MoUSDDebt()
  th.logBN("L_ETH", L_ETH)
  th.logBN("L_MoUSDDebt", L_MoUSDDebt)

  // StabilityPool
  console.log("StabilityPool state variables:")
  const P = await mosaicCore.stabilityPool.P()
  const currentScale = await mosaicCore.stabilityPool.currentScale()
  const currentEpoch = await mosaicCore.stabilityPool.currentEpoch()
  const S = await mosaicCore.stabilityPool.epochToScaleToSum(currentEpoch, currentScale)
  const G = await mosaicCore.stabilityPool.epochToScaleToG(currentEpoch, currentScale)
  th.logBN("Product P", P)
  th.logBN("Current epoch", currentEpoch)
  th.logBN("Current scale", currentScale)
  th.logBN("Sum S, at current epoch and scale", S)
  th.logBN("Sum G, at current epoch and scale", G)

  // MSICStaking
  console.log("MSICStaking state variables:")
  const F_MoUSD = await MSICContracts.msicStaking.F_MoUSD()
  const F_ETH = await MSICContracts.msicStaking.F_ETH()
  th.logBN("F_MoUSD", F_MoUSD)
  th.logBN("F_ETH", F_ETH)


  // CommunityIssuance
  console.log("CommunityIssuance state variables:")
  const totalMSICIssued = await MSICContracts.communityIssuance.totalMSICIssued()
  th.logBN("Total MSIC issued to depositors / front ends", totalMSICIssued)


  // TODO: Uniswap *MSIC-REEF* pool size (check it's deployed?)















  // ************************
  // --- NOT FOR APRIL 5: Deploy a MSICToken2 with General Safe as beneficiary to test minting MSIC showing up in Gnosis App  ---

  // // General Safe MSIC bal before:
  // const realGeneralSafeAddr = "0xF06016D822943C42e3Cb7FC3a6A3B1889C1045f8"

  //   const MSICToken2EthersFactory = await ethers.getContractFactory("MSICToken2", deployerWallet)
  //   const msicToken2 = await MSICToken2EthersFactory.deploy( 
  //     "0xF41E0DD45d411102ed74c047BdA544396cB71E27",  // CI param: LC1 
  //     "0x9694a04263593AC6b895Fc01Df5929E1FC7495fA", // MSIC Staking param: LC2
  //     "0x98f95E112da23c7b753D8AE39515A585be6Fb5Ef", // LCF param: LC3
  //     realGeneralSafeAddr,  // bounty/hackathon param: REAL general safe addr
  //     "0x98f95E112da23c7b753D8AE39515A585be6Fb5Ef", // LP rewards param: LC3
  //     deployerWallet.address, // multisig param: deployer wallet
  //     {gasPrice, gasLimit: 10000000}
  //   )

  //   console.log(`msic2 address: ${msicToken2.address}`)

  //   let generalSafeMSICBal = await msicToken2.balanceOf(realGeneralSafeAddr)
  //   console.log(`generalSafeMSICBal: ${generalSafeMSICBal}`)



  // ************************
  // --- NOT FOR APRIL 5: Test short-term lockup contract MSIC withdrawal on mainnet ---

  // now = (await ethers.provider.getBlock(latestBlock)).timestamp

  // const LCShortTermEthersFactory = await ethers.getContractFactory("LockupContractShortTerm", deployerWallet)

  // new deployment
  // const LCshortTerm = await LCShortTermEthersFactory.deploy(
  //   MSICContracts.msicToken.address,
  //   deployerWallet.address,
  //   now, 
  //   {gasPrice, gasLimit: 1000000}
  // )

  // LCshortTerm.deployTransaction.wait()

  // existing deployment
  // const deployedShortTermLC = await new ethers.Contract(
  //   "0xbA8c3C09e9f55dA98c5cF0C28d15Acb927792dC7", 
  //   LCShortTermEthersFactory.interface,
  //   deployerWallet
  // )

  // new deployment
  // console.log(`Short term LC Address:  ${LCshortTerm.address}`)
  // console.log(`recorded beneficiary in short term LC:  ${await LCshortTerm.beneficiary()}`)
  // console.log(`recorded short term LC name:  ${await LCshortTerm.NAME()}`)

  // existing deployment
  //   console.log(`Short term LC Address:  ${deployedShortTermLC.address}`)
  //   console.log(`recorded beneficiary in short term LC:  ${await deployedShortTermLC.beneficiary()}`)
  //   console.log(`recorded short term LC name:  ${await deployedShortTermLC.NAME()}`)
  //   console.log(`recorded short term LC name:  ${await deployedShortTermLC.unlockTime()}`)
  //   now = (await ethers.provider.getBlock(latestBlock)).timestamp
  //   console.log(`time now: ${now}`)

  //   // check deployer MSIC bal
  //   let deployerMSICBal = await MSICContracts.msicToken.balanceOf(deployerWallet.address)
  //   console.log(`deployerMSICBal before he withdraws: ${deployerMSICBal}`)

  //   // check LC MSIC bal
  //   let LC_MSICBal = await MSICContracts.msicToken.balanceOf(deployedShortTermLC.address)
  //   console.log(`LC MSIC bal before withdrawal: ${LC_MSICBal}`)

  // // withdraw from LC
  // const withdrawFromShortTermTx = await deployedShortTermLC.withdrawMSIC( {gasPrice, gasLimit: 1000000})
  // withdrawFromShortTermTx.wait()

  // // check deployer bal after LC withdrawal
  // deployerMSICBal = await MSICContracts.msicToken.balanceOf(deployerWallet.address)
  // console.log(`deployerMSICBal after he withdraws: ${deployerMSICBal}`)

  //   // check LC MSIC bal
  //   LC_MSICBal = await MSICContracts.msicToken.balanceOf(deployedShortTermLC.address)
  //   console.log(`LC MSIC bal after withdrawal: ${LC_MSICBal}`)
}

module.exports = {
  mainnetDeploy
}
