// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "hardhat/console.sol";

error PenguinIpfsNft__AlreadyInitialized();
error PenguinIpfsNft__NeedMoreETHSent();
error PenguinIpfsNft__RangeOutOfBounds();
error PenguinIpfsNft__TransferFailed();

contract PenguinIpfsNft is ERC721URIStorage, VRFConsumerBaseV2, Ownable {
    // Types
    enum PenguinBreed {
        EMPEROR,
        CHINSTRAP,
        MACARONI
    }

    // Chainlink VRF Variables
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // NFT Variables
    uint256 private immutable i_mintFee;
    uint256 private s_tokenCounter;
    uint256 internal constant MAX_CHANCE_VALUE = 100;
    string[] internal s_penguinTokenUris;
    bool private s_initialized;

    // VRF Helpers
    mapping(uint256 => address) public s_requestIdToSender;

    // Events
    event NftRequested(uint256 indexed requestId, address requester);
    event NftMinted(PenguinBreed breed, address minter);

    constructor(
        address vrfCoordinatorV2,
        uint64 subscriptionId,
        bytes32 gasLane, // keyHash
        uint256 mintFee,
        uint32 callbackGasLimit,
        string[3] memory penguinTokenUris
    ) VRFConsumerBaseV2(vrfCoordinatorV2) ERC721("Penguin", "PENG") {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_subscriptionId = subscriptionId;
        i_gasLane = gasLane;
        i_mintFee = mintFee;
        i_callbackGasLimit = callbackGasLimit;
        _initializeContract(penguinTokenUris);
    }

    function requestNft() public payable returns (uint256 requestId) {
        if (msg.value < i_mintFee) {
            revert PenguinIpfsNft__NeedMoreETHSent();
        }
        requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        s_requestIdToSender[requestId] = msg.sender;
        emit NftRequested(requestId, msg.sender);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address penguinOwner = s_requestIdToSender[requestId];
        uint256 newItemId = s_tokenCounter;
        s_tokenCounter = s_tokenCounter + 1;
        uint256 moddedRng = randomWords[0] % MAX_CHANCE_VALUE;
        PenguinBreed penguinBreed = getBreedFromModdedRng(moddedRng);
        _safeMint(penguinOwner, newItemId);
        _setTokenURI(newItemId, s_penguinTokenUris[uint256(penguinBreed)]);
        emit NftMinted(penguinBreed, penguinOwner);
    }

    function getChanceArray() public pure returns (uint256[3] memory) {
        return [10, 40, MAX_CHANCE_VALUE];
    }

    function _initializeContract(string[3] memory penguinTokenUris) private {
        if (s_initialized) {
            revert PenguinIpfsNft__AlreadyInitialized();
        }
        s_penguinTokenUris = penguinTokenUris;
        s_initialized = true;
    }

    function getBreedFromModdedRng(uint256 moddedRng) public pure returns (PenguinBreed) {
        uint256 cumulativeSum = 0;
        uint256[3] memory chanceArray = getChanceArray();
        for (uint256 i = 0; i < chanceArray.length; i++) {
                // Empreror = 0 - 9  (10%)
                // Chinstrap = 10 - 39  (30%)
                // Macaroni = 40 = 99 (60%)
            if (moddedRng >= cumulativeSum && moddedRng < chanceArray[i]) {
                return PenguinBreed(i);
            }
            cumulativeSum = chanceArray[i];
        }
        revert PenguinIpfsNft__RangeOutOfBounds();
    }

    function withdraw() public onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert PenguinIpfsNft__TransferFailed();
        }
    }

    function getMintFee() public view returns (uint256) {
        return i_mintFee;
    }

    function getPenguinTokenUris(uint256 index) public view returns (string memory) {
        return s_penguinTokenUris[index];
    }

    function getInitialized() public view returns (bool) {
        return s_initialized;
    }

    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }
}