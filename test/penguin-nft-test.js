// We are going to skimp a bit on these tests...

const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Penguin IPFS NFT Unit Tests", function () {
          let penguinIpfsNft, deployer, vrfCoordinatorV2Mock

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              await deployments.fixture(["mocks", "randomipfs"])
              penguinIpfsNft = await ethers.getContract("PenguinIpfsNft")
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
          })

          describe("constructor", () => {
              it("sets starting values correctly", async function () {
                  const penguinTokenUriZero = await penguinIpfsNft.getPenguinTokenUris(0)
                  const isInitialized = await penguinIpfsNft.getInitialized()
                  const tokenCounter = await penguinIpfsNft.getTokenCounter()
                  assert(penguinTokenUriZero.includes("ipfs://"))
                  assert.equal(isInitialized, true)
                  assert.equal(ethers.utils.formatEther(tokenCounter), 0.0)
              })
          })

          describe("requestNft", () => {
              it("fails if payment isn't sent with the request", async function () {
                  await expect(penguinIpfsNft.requestNft()).to.be.revertedWith(
                      "PenguinIpfsNft__NeedMoreETHSent"
                  )
              })
              it("reverts if payment amount is less than the mint fee", async function () {
                  const fee = await penguinIpfsNft.getMintFee()
                  await expect(
                      penguinIpfsNft.requestNft({
                          value: fee.sub(ethers.utils.parseEther("0.001")),
                      })
                  ).to.be.revertedWith("PenguinIpfsNft__NeedMoreETHSent")
              })
              it("emits an event and kicks off a random word request", async function () {
                  const fee = await penguinIpfsNft.getMintFee()
                  await expect(penguinIpfsNft.requestNft({ value: fee.toString() })).to.emit(
                      penguinIpfsNft,
                      "NftRequested"
                  )
              })
          })
          describe("fulfillRandomWords", () => {
              it("mints NFT after random number is returned", async function () {
                  await new Promise(async (resolve, reject) => {
                      penguinIpfsNft.once("NftMinted", async () => {
                          try {
                              const tokenUri = await penguinIpfsNft.tokenURI("0")
                              const tokenCounter = await penguinIpfsNft.getTokenCounter()
                              assert.equal(tokenUri.toString().includes("ipfs://"), true)
                              assert.equal(tokenCounter.toString(), "1")
                              resolve()
                          } catch (e) {
                              console.log(e)
                              reject(e)
                          }
                      })
                      try {
                          const fee = await penguinIpfsNft.getMintFee()
                          const requestNftResponse = await penguinIpfsNft.requestNft({
                              value: fee.toString(),
                          })
                          const requestNftReceipt = await requestNftResponse.wait(1)
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              requestNftReceipt.events[1].args.requestId,
                              penguinIpfsNft.address
                          )
                      } catch (e) {
                          console.log(e)
                          reject(e)
                      }
                  })
              })
          })
          describe("getBreedFromModdedRng", () => {
              it("should return emperor if moddedRng < 10", async function () {
                  const expectedValue = await penguinIpfsNft.getBreedFromModdedRng(7)
                  assert.equal(0, expectedValue)
              })
              it("should return chinstrap if moddedRng is between 10 - 39", async function () {
                  const expectedValue = await penguinIpfsNft.getBreedFromModdedRng(21)
                  assert.equal(1, expectedValue)
              })
              it("should return macaroni if moddedRng is between 40 - 99", async function () {
                  const expectedValue = await penguinIpfsNft.getBreedFromModdedRng(77)
                  assert.equal(2, expectedValue)
              })
              it("should revert if moddedRng > 99", async function () {
                  await expect(penguinIpfsNft.getBreedFromModdedRng(100)).to.be.revertedWith(
                      "PenguinIpfsNft__RangeOutOfBounds"
                  )
              })
          })
      })