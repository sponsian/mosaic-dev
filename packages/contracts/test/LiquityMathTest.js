const MosaicMathTester = artifacts.require("./MosaicMathTester.sol")

contract('MosaicMath', async accounts => {
  let mosaicMathTester
  beforeEach('deploy tester', async () => {
    mosaicMathTester = await MosaicMathTester.new()
  })

  const checkFunction = async (func, cond, params) => {
    assert.equal(await mosaicMathTester[func](...params), cond(...params))
  }

  it('max works if a > b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [2, 1])
  })

  it('max works if a = b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [2, 2])
  })

  it('max works if a < b', async () => {
    await checkFunction('callMax', (a, b) => Math.max(a, b), [1, 2])
  })
})
