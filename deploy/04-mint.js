const { network, ethers } = require("hardhat")

module.exports = async ({ getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId

  // Basic NFT
  const basicNft = await ethers.getContract("BasicNFT", deployer)
  const basicMintTx = await basicNft.mintNft()
  await basicMintTx.wait(1)
  console.log(`Basic NFT index 0 tokenURI: ${await basicNft.tokenURI(0)}`)

  // Dynamic SVG  NFT
  const highValue = ethers.utils.parseEther("4000")
  const dynamicSvgNft = await ethers.getContract("DynamicSvgNft", deployer)
  const dynamicSvgNftMintTx = await dynamicSvgNft.mintNft(highValue)
  await dynamicSvgNftMintTx.wait(1)
  console.log(
    `Dynamic SVG NFT index 0 tokenURI: ${await dynamicSvgNft.tokenURI(0)}`
  )

  // Penguin IPFS NFT
  const penguinIpfsNft = await ethers.getContract("PenguinIpfsNft", deployer)
  const mintFee = await penguinIpfsNft.getMintFee()
  const penguinIpfsNftMintTx = await penguinIpfsNft.requestNft({
    value: mintFee.toString()
  })
  const penguinIpfsNftMintTxReceipt = await penguinIpfsNftMintTx.wait(1)
  // Need to listen for response
  await new Promise(async (resolve, reject) => {
    setTimeout(() => reject("Timeout: 'NFTMinted' event did not fire"), 300000) // 5 minute timeout time
    // setup listener for our event
    penguinIpfsNft.once("NftMinted", async () => {
      resolve()
    })
    if (chainId == 31337) {
      const requestId = penguinIpfsNftMintTxReceipt.events[1].args.requestId.toString()
      const vrfCoordinatorV2Mock = await ethers.getContract(
        "VRFCoordinatorV2Mock",
        deployer
      )
      await vrfCoordinatorV2Mock.fulfillRandomWords(
        requestId,
        penguinIpfsNft.address
      )
    }
  })
  console.log(
    `Penguin IPFS NFT index 0 tokenURI: ${await penguinIpfsNft.tokenURI(0)}`
  )
}
module.exports.tags = ["all", "mint"]
