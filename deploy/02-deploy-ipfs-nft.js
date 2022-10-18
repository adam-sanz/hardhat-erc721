const { network } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const {
  storeImages,
  storeTokenUriMetadata
} = require("../utils/uploadToPinata")

const FUND_AMOUNT = "1000000000000000000000"
const imagesLocation = "./images/randomNFT/"
const penguinDescription = {
  emperor: "secret rare",
  chinstrap: "rare",
  macaroni: "common"
}

let tokenUris = [
  'ipfs://QmR4yfZCMKHXTRaE7BQ73fEZFb1Cfbs19AQXxJadFKNojp',
  'ipfs://QmbjdTvxNLS6CazgqCE3bkpkufyiDLTaGUpLzEY6dUpa3U',
  'ipfs://QmYFUXzd7tXsb5U1pDjf8wEABT2GkK3vXnGMaz7PBJm3df'
]

const metadataTemplate = {
  name: "",
  description: "",
  image: "",
  attributes: [
    {
      attack: 0,
      defense: 0,
      agility: 0,
      intellect: 0
    }
  ]
}

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

  if (process.env.UPLOAD_TO_PINATA == "true") {
    tokenUris = await handleTokenUris()
  }

  if (chainId == 31337) {
    // create VRFV2 Subscription
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
    const transactionReceipt = await transactionResponse.wait()
    subscriptionId = transactionReceipt.events[0].args.subId
    // Fund the subscription
    // Our mock makes it so we don't actually have to worry about sending fund
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
    subscriptionId = networkConfig[chainId].subscriptionId
  }

  log("----------------------------------------------------")
  arguments = [
    vrfCoordinatorV2Address,
    subscriptionId,
    networkConfig[chainId]["gasLane"],
    networkConfig[chainId]["mintFee"],
    networkConfig[chainId]["callbackGasLimit"],
    tokenUris
  ]
  const randomIpfsNft = await deploy("PenguinIpfsNft", {
    from: deployer,
    args: arguments,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1
  })

  if (chainId == 31337) {
    await vrfCoordinatorV2Mock.addConsumer(
      subscriptionId,
      randomIpfsNft.address
    )
  }

  // Verify the deployment
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying...")
    await verify(randomIpfsNft.address, arguments)
  }
}

function setAttributes(name){
  if(name.toLowerCase() === "emperor"){
    return [{attack: 99, defense: 99, agility: 99, intellect: 99 }]
  } 
  if(name.toLowerCase() === "chinstrap"){
    return [{attack: 88, defense: 88, agility: 88, intellect: 88 }]
  }
  if(name.toLowerCase() === "macaroni"){
    return [{attack: 77, defense: 77, agility: 77, intellect: 77 }]
  }
}

async function handleTokenUris() {
  // Check out https://github.com/PatrickAlphaC/nft-mix for a pythonic version of uploading
  // to the raw IPFS-daemon from https://docs.ipfs.io/how-to/command-line-quick-start/
  // You could also look at pinata https://www.pinata.cloud/
  tokenUris = []
  const { responses: imageUploadResponses, files } = await storeImages(
    imagesLocation
  )
  for (imageUploadResponseIndex in imageUploadResponses) {
    let tokenUriMetadata = { ...metadataTemplate }
    tokenUriMetadata.name = files[imageUploadResponseIndex].replace(".png", "")
    tokenUriMetadata.description = `A ${penguinDescription[tokenUriMetadata.name]} penguin`
    tokenUriMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponseIndex].IpfsHash}`
    tokenUriMetadata.attributes = setAttributes(tokenUriMetadata.name)

    console.log(`Uploading ${tokenUriMetadata.name}...`)

    const metadataUploadResponse = await storeTokenUriMetadata(tokenUriMetadata)
    tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
  }
  console.log("Token URIs uploaded! They are:")
  console.log(tokenUris)
  return tokenUris
}

module.exports.tags = ["all", "randomipfs", "main"]
