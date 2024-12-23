/***************************************************
 * main.js
 * -----------------------------------------------
 * Handles:
 * 1) Wallet connection (MetaMask or WalletConnect)
 * 2) UI updates based on connection status
 * 3) Fetching and displaying active assets and rounds
 * 4) Buying Predict Up/Down tickets
 * 5) Countdown timers for rounds
 * 6) Displaying connection info in the footer
 * 7) Exposing contract globally for admin use
 ***************************************************/



//this part is only for demo... rest is testing towards functionality
  
  $(document).ready(function() {
    // Countdown from 19:00 (1140 seconds)
    let totalSeconds = 1140;

    function updateCountdownDisplay() {
      let minutes = Math.floor(totalSeconds / 60);
      let seconds = totalSeconds % 60;
      let displayMin = minutes.toString().padStart(2,'0');
      let displaySec = seconds.toString().padStart(2,'0');

      $('#minutes-val').text(displayMin);
      $('#seconds-val').text(displaySec);
    }

    function runCountdown() {
      totalSeconds--;
      if (totalSeconds < 0) {
        // Restart at 19:00
        totalSeconds = 1140;
      }
      updateCountdownDisplay();
    }

    // Initial display
    updateCountdownDisplay();
    setInterval(runCountdown, 1000);
  });

//end of example countdown for demo

$(document).ready(function () {
  /***************************************************
   * GLOBAL CONFIG & STATE
   ***************************************************/
  const CONTRACT_ADDRESS = "0xb8D1Ad0F6db11BD389120E969b36C0d93BFb84b5";

 const CONTRACT_ABI = [
  // Initialize function
  {
    "inputs": [
      { "internalType": "address", "name": "_usdc", "type": "address" },
      { "internalType": "address", "name": "_daoTreasury", "type": "address" },
      { "internalType": "address", "name": "_maintainer", "type": "address" }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  
  // Admin Functions
  {
    "inputs": [
      { "internalType": "address", "name": "newMaintainer", "type": "address" }
    ],
    "name": "transferMaintainer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "newDao", "type": "address" }
    ],
    "name": "setDaoTreasury",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_teddyBearFeeBps", "type": "uint256" },
      { "internalType": "uint256", "name": "_ticketFeeBps", "type": "uint256" }
    ],
    "name": "setFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "assetToken", "type": "address" },
      { "internalType": "uint256", "name": "interval", "type": "uint256" },
      { "internalType": "bool", "name": "repeating", "type": "bool" },
      { "internalType": "address", "name": "oracle", "type": "address" }
    ],
    "name": "proposeAssetConfig",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "name": "approveAssetConfig",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "bool", "name": "active", "type": "bool" }
    ],
    "name": "setAssetActive",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "address", "name": "newOracle", "type": "address" }
    ],
    "name": "setAssetOracle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "uint256", "name": "roundID", "type": "uint256" }
    ],
    "name": "distributeBears",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "withdrawTokens",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "teddyId", "type": "uint256" }
    ],
    "name": "sellTeddyBear",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  
  // Core Functions
  {
    "inputs": [
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "uint256", "name": "roundID", "type": "uint256" },
      { "internalType": "uint256", "name": "startTime", "type": "uint256" }
    ],
    "name": "startRound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "uint256", "name": "roundID", "type": "uint256" },
      { "internalType": "bool", "name": "predictUp", "type": "bool" },
      { "internalType": "uint256", "name": "ticketCount", "type": "uint256" }
    ],
    "name": "buyTicket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "uint256", "name": "roundID", "type": "uint256" }
    ],
    "name": "endRound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "uint256", "name": "roundID", "type": "uint256" }
    ],
    "name": "redeemTicketsForBears",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  
  // View Functions
  {
    "inputs": [
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "uint256", "name": "roundID", "type": "uint256" }
    ],
    "name": "currentTicketPrice",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "ownerOf",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Getters for Public Variables
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "assets",
    "outputs": [
      { "internalType": "address", "name": "assetToken", "type": "address" },
      { "internalType": "uint256", "name": "interval", "type": "uint256" },
      { "internalType": "bool", "name": "repeating", "type": "bool" },
      { "internalType": "address", "name": "priceOracle", "type": "address" },
      { "internalType": "bool", "name": "active", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "rounds",
    "outputs": [
      { "internalType": "uint256", "name": "startTime", "type": "uint256" },
      { "internalType": "uint256", "name": "endTime", "type": "uint256" },
      { "internalType": "uint256", "name": "initialPrice", "type": "uint256" },
      { "internalType": "uint256", "name": "finalPrice", "type": "uint256" },
      { "internalType": "bool", "name": "priceCaptured", "type": "bool" },
      { "internalType": "bool", "name": "ended", "type": "bool" },
      { "internalType": "uint256", "name": "upPool", "type": "uint256" },
      { "internalType": "uint256", "name": "downPool", "type": "uint256" },
      { "internalType": "bool", "name": "bearsDistributed", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "uint256", "name": "roundID", "type": "uint256" }
    ],
    "name": "userUpStakes",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "uint256", "name": "roundID", "type": "uint256" }
    ],
    "name": "userDownStakes",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "proposals",
    "outputs": [
      { "internalType": "address", "name": "assetToken", "type": "address" },
      { "internalType": "uint256", "name": "interval", "type": "uint256" },
      { "internalType": "bool", "name": "repeating", "type": "bool" },
      { "internalType": "address", "name": "priceOracle", "type": "address" },
      { "internalType": "bool", "name": "proposed", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  
  // ERC721 Functions
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "from", "type": "address" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "transferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "getApproved",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "operator", "type": "address" },
      { "internalType": "bool", "name": "approved", "type": "bool" }
    ],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "operator", "type": "address" }
    ],
    "name": "isApprovedForAll",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "tokenURI",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  
  // Getter for assetCount
  {
    "inputs": [],
    "name": "assetCount",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Getter for assets(uint256)
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "assets",
    "outputs": [
      { "internalType": "address", "name": "assetToken", "type": "address" },
      { "internalType": "uint256", "name": "interval", "type": "uint256" },
      { "internalType": "bool", "name": "repeating", "type": "bool" },
      { "internalType": "address", "name": "priceOracle", "type": "address" },
      { "internalType": "bool", "name": "active", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Getter for rounds(uint256, uint256)
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "rounds",
    "outputs": [
      { "internalType": "uint256", "name": "startTime", "type": "uint256" },
      { "internalType": "uint256", "name": "endTime", "type": "uint256" },
      { "internalType": "uint256", "name": "initialPrice", "type": "uint256" },
      { "internalType": "uint256", "name": "finalPrice", "type": "uint256" },
      { "internalType": "bool", "name": "priceCaptured", "type": "bool" },
      { "internalType": "bool", "name": "ended", "type": "bool" },
      { "internalType": "uint256", "name": "upPool", "type": "uint256" },
      { "internalType": "uint256", "name": "downPool", "type": "uint256" },
      { "internalType": "bool", "name": "bearsDistributed", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Getter for userUpStakes(address, uint256, uint256)
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "uint256", "name": "roundID", "type": "uint256" }
    ],
    "name": "userUpStakes",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Getter for userDownStakes(address, uint256, uint256)
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "internalType": "uint256", "name": "roundID", "type": "uint256" }
    ],
    "name": "userDownStakes",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Getter for proposals(uint256)
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "proposals",
    "outputs": [
      { "internalType": "address", "name": "assetToken", "type": "address" },
      { "internalType": "uint256", "name": "interval", "type": "uint256" },
      { "internalType": "bool", "name": "repeating", "type": "bool" },
      { "internalType": "address", "name": "priceOracle", "type": "address" },
      { "internalType": "bool", "name": "proposed", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Supports Interface
  {
    "inputs": [
      { "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" }
    ],
    "name": "supportsInterface",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  
  // Fallback and Receive Functions
  {
    "stateMutability": "payable",
    "type": "receive",
    "inputs": []
  },
  
  {
    "stateMutability": "payable",
    "type": "fallback",
    "inputs": []
  },
  
  // Events
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "oldMaintainer", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "newMaintainer", "type": "address" }
    ],
    "name": "MaintainerChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "oldDao", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "newDao", "type": "address" }
    ],
    "name": "DaoTreasuryChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "teddyBearFeeBps", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "ticketFeeBps", "type": "uint256" }
    ],
    "name": "FeeChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "indexed": false, "internalType": "address", "name": "assetToken", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "interval", "type": "uint256" },
      { "indexed": false, "internalType": "bool", "name": "repeating", "type": "bool" },
      { "indexed": false, "internalType": "address", "name": "oracle", "type": "address" }
    ],
    "name": "AssetProposed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "indexed": false, "internalType": "address", "name": "assetToken", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "interval", "type": "uint256" },
      { "indexed": false, "internalType": "bool", "name": "repeating", "type": "bool" },
      { "indexed": false, "internalType": "address", "name": "oracle", "type": "address" }
    ],
    "name": "AssetApproved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "indexed": false, "internalType": "bool", "name": "active", "type": "bool" }
    ],
    "name": "AssetActivated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "indexed": false, "internalType": "address", "name": "newOracle", "type": "address" }
    ],
    "name": "OracleChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "roundID", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "startTime", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "endTime", "type": "uint256" }
    ],
    "name": "RoundStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "roundID", "type": "uint256" },
      { "indexed": false, "internalType": "bool", "name": "up", "type": "bool" },
      { "indexed": false, "internalType": "uint256", "name": "amountPaid", "type": "uint256" }
    ],
    "name": "TicketPurchased",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "roundID", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "finalPrice", "type": "uint256" }
    ],
    "name": "RoundEnded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "roundID", "type": "uint256" }
    ],
    "name": "BearsDistributed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "teddyId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "usdcReceived", "type": "uint256" }
    ],
    "name": "TeddyBearSold",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "teddyId", "type": "uint256" }
    ],
    "name": "TeddyBearMinted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "assetID", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "roundID", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "ticketsRedeemed", "type": "uint256" }
    ],
    "name": "TicketsRedeemedForBears",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "token", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "TokensWithdrawn",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "ETHWithdrawn",
    "type": "event"
  }
];



  // For zkSync Era mainnet: chain ID = 324 = 0x144
  // For zkSync Era testnet: chain ID = 280 = 0x118
  const ZKSYNC_CHAIN_ID_HEX = "0x144"; // Change to "0x118" for testnet

  // Web3 variables
  let web3;
  let contract;
  let selectedAccount;
  let walletConnectProvider;
  let isWalletConnect = false; // Flag to differentiate between MetaMask and WalletConnect

  // An in-memory model of the assets & rounds we discover
  let assetsData = [];

  // Simple flag to track if user is connected
  let isConnected = false;

  /***************************************************
   * INIT: On page load, set up the UI
   ***************************************************/
  initUI();
  updateFooter(); // Show "Not connected" initially

  /***************************************************
   * UI & DOM CREATION / BINDINGS
   ***************************************************/
  function initUI() {
    // Ensure the "Connect Wallet" button has the correct ID and initial text
    const connectBtn = $("#connect-wallet-btn");
    if (!connectBtn.length) {
      // If the button doesn't exist, create it
      $(".right-group").append('<button class="btn btn-secondary btn-sm" id="connect-wallet-btn">Connect Wallet</button>');
    } else {
      connectBtn.text("Connect Wallet");
    }

    // Bind the click event to the connect button
    $("#connect-wallet-btn").off("click").on("click", function () {
      if (!isConnected) {
        pickWalletConnection();
      } else {
        // Show disconnect option using SweetAlert2
        Swal.fire({
          title: 'Disconnect Wallet',
          text: "Do you want to disconnect your wallet?",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, disconnect',
          cancelButtonText: 'Cancel'
        }).then((result) => {
          if (result.isConfirmed) {
            disconnectWallet();
          }
        });
      }
    });
  }

  /**
   * Updates the footer to show the contract address, network, and connected account.
   */
  function updateFooter() {
    // Assuming your footer has two divs: left-group and right-group
    const footerLeft = $(".footer-bar .left-group");
    const footerRight = $(".footer-bar .right-group");

    // Clear footer info (except GitHub link in left-group)
    footerRight.empty();

    if (!isConnected) {
      footerRight.append(`
        <span>
          <span class="status-indicator status-disconnected"></span> Not connected
        </span>
      `);
      return;
    }

    // If connected, show contract, network, and account
    let chainName = "(unknown)";
    if (parseInt(ZKSYNC_CHAIN_ID_HEX, 16) === 324) chainName = "zkSync Era Mainnet";
    if (parseInt(ZKSYNC_CHAIN_ID_HEX, 16) === 280) chainName = "zkSync Era Testnet";

    const shortAccount = selectedAccount
      ? `${selectedAccount.slice(0, 6)}...${selectedAccount.slice(-4)}`
      : "???";

    footerRight.append(`
      <span>
        <span class="status-indicator status-connected"></span> Connected
      </span>
      <span>
        <strong>Contract:</strong> ${CONTRACT_ADDRESS}
      </span>
      <span>
        <strong>Network:</strong> ${chainName}
      </span>
      <span>
        <strong>Account:</strong> ${shortAccount}
      </span>
    `);
  }

  /***************************************************
   * WALLET CONNECTION
   ***************************************************/

  /**
   * Let user pick MetaMask or WalletConnect.
   */
  function pickWalletConnection() {
    Swal.fire({
      title: 'Connect Wallet',
      text: "Choose your wallet connection method:",
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'MetaMask',
      denyButtonText: 'WalletConnect',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        connectWithMetaMask();
      } else if (result.isDenied) {
        connectWithWalletConnect();
      }
    });
  }

  /**
   * Connect using MetaMask.
   */
  async function connectWithMetaMask() {
    if (typeof window.ethereum === "undefined") {
      Swal.fire("MetaMask not found", "Please install MetaMask to use this feature.", "error");
      return;
    }
    try {
      // Request accounts
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      selectedAccount = accounts[0] || null;
      if (!selectedAccount) {
        Swal.fire("No account selected", "Please select an account in MetaMask.", "error");
        return;
      }
      // Initialize web3 with MetaMask provider
      await initWeb3(window.ethereum);
      await ensureZkSyncNetwork(); // Attempt to switch to or confirm zkSync network
      isConnected = true;
      isWalletConnect = false;
      updateFooter();
      // Update the connect button to show connected status
      $("#connect-wallet-btn").html(`Connected: ${shortenAddress(selectedAccount)} <i class="bi bi-box-arrow-right disconnect-icon"></i>`);
      // After connection, load the contract data
      await loadActiveAssetsAndRounds();
      // Listen for account changes
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      // Expose contract globally
      window.contract = contract;
    } catch (err) {
      console.error(err);
      Swal.fire("Connection Error", err.message, "error");
    }
  }

  /**
   * Connect using WalletConnect.
   */
  async function connectWithWalletConnect() {
    if (!window.WalletConnectProvider) {
      Swal.fire("WalletConnect Provider not found", "Please ensure WalletConnect library is loaded.", "error");
      return;
    }
    try {
      walletConnectProvider = new WalletConnectProvider.default({
        chainId: parseInt(ZKSYNC_CHAIN_ID_HEX, 16),
        rpc: {
          324: "https://mainnet.era.zksync.io",
          280: "https://testnet.era.zksync.dev",
        },
        bridge: "https://bridge.walletconnect.org",
      });
      await walletConnectProvider.enable(); // Triggers QR Code modal
      await initWeb3(walletConnectProvider);
      const accounts = await web3.eth.getAccounts();
      selectedAccount = accounts[0] || null;
      if (!selectedAccount) {
        Swal.fire("No account selected", "Please select an account in your wallet.", "error");
        return;
      }
      isConnected = true;
      isWalletConnect = true;
      updateFooter();
      // Update the connect button to show connected status
      $("#connect-wallet-btn").html(`Connected: ${shortenAddress(selectedAccount)} <i class="bi bi-box-arrow-right disconnect-icon"></i>`);
      // After connection, load data
      await loadActiveAssetsAndRounds();
      // Listen for session updates
      walletConnectProvider.on("accountsChanged", handleAccountsChangedWC);
      walletConnectProvider.on("chainChanged", handleChainChangedWC);
      walletConnectProvider.on("disconnect", handleDisconnectWC);
      // Expose contract globally
      window.contract = contract;
    } catch (err) {
      console.error(err);
      Swal.fire("Connection Error", err.message, "error");
    }
  }

  /**
   * Initialize web3 and contract instance.
   */
  async function initWeb3(provider) {
    web3 = new Web3(provider);
    contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
  }

  /**
   * Ensure the user is on the zkSync Era network.
   * If not, attempt to switch or add the network (only for MetaMask).
   */
  async function ensureZkSyncNetwork() {
    try {
      const chainId = await web3.eth.getChainId();
      if (chainId !== parseInt(ZKSYNC_CHAIN_ID_HEX, 16)) {
        if (!isWalletConnect) { // MetaMask can switch networks
          try {
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: ZKSYNC_CHAIN_ID_HEX }],
            });
          } catch (switchError) {
            // If the chain isn't added to MetaMask, add it
            if (switchError.code === 4902) {
              try {
                await window.ethereum.request({
                  method: "wallet_addEthereumChain",
                  params: [
                    {
                      chainId: ZKSYNC_CHAIN_ID_HEX,
                      chainName: "zkSync Era",
                      nativeCurrency: {
                        name: "ETH",
                        symbol: "ETH",
                        decimals: 18,
                      },
                      rpcUrls: ["https://mainnet.era.zksync.io"], // or your chosen provider
                      blockExplorerUrls: ["https://explorer.zksync.io/"],
                    },
                  ],
                });
              } catch (addError) {
                console.error(addError);
                Swal.fire("Network Error", `Could not add zkSync Era network: ${addError.message}`, "error");
              }
            } else {
              console.error(switchError);
              Swal.fire("Network Error", `Could not switch to zkSync Era network: ${switchError.message}`, "error");
            }
          }
        } else {
          // For WalletConnect, prompt the user to switch networks manually
          Swal.fire("Network Mismatch", "Please switch to the zkSync Era network in your wallet.", "warning");
        }
      }
    } catch (err) {
      console.error("Error ensuring zkSync network:", err);
      Swal.fire("Network Error", err.message, "error");
    }
  }

  /**
   * Disconnect the wallet.
   */
  async function disconnectWallet() {
    try {
      if (isWalletConnect && walletConnectProvider) {
        await walletConnectProvider.disconnect();
      }
      // Reset state
      selectedAccount = null;
      isConnected = false;
      isWalletConnect = false;
      web3 = null;
      contract = null;
      assetsData = [];
      updateFooter();
      Swal.fire("Disconnected", "Your wallet has been disconnected.", "info");
      // Reset the connect button
      $("#connect-wallet-btn").html(`Connect Wallet`);
      // Remove assets UI
      $("#assets-section").remove();
      // Clear countdown timers
      if (window._countdownInterval) {
        clearInterval(window._countdownInterval);
      }
      // Remove event listeners
      if (!isWalletConnect && window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
      if (isWalletConnect && walletConnectProvider) {
        walletConnectProvider.removeListener("accountsChanged", handleAccountsChangedWC);
        walletConnectProvider.removeListener("chainChanged", handleChainChangedWC);
        walletConnectProvider.removeListener("disconnect", handleDisconnectWC);
      }
      // Remove global contract reference
      delete window.contract;
    } catch (err) {
      console.error("Disconnect Error:", err);
      Swal.fire("Disconnect Error", err.message, "error");
    }
  }

  /**
   * Handle account changes (MetaMask).
   */
  function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
      // MetaMask is locked or the user has not connected any accounts
      disconnectWallet();
    } else {
      selectedAccount = accounts[0];
      updateFooter();
      Swal.fire("Account Changed", `You're now connected as ${shortenAddress(selectedAccount)}`, "info");
      // Reload assets and rounds
      loadActiveAssetsAndRounds();
      // Update connect button text
      $("#connect-wallet-btn").html(`Connected: ${shortenAddress(selectedAccount)} <i class="bi bi-box-arrow-right disconnect-icon"></i>`);
    }
  }

  /**
   * Handle chain changes (MetaMask).
   */
  function handleChainChanged(chainId) {
    // Reload the page to avoid any inconsistencies
    window.location.reload();
  }

  /**
   * Handle account changes (WalletConnect).
   */
  function handleAccountsChangedWC(accounts) {
    if (accounts.length === 0) {
      // WalletConnect session disconnected
      disconnectWallet();
    } else {
      selectedAccount = accounts[0];
      updateFooter();
      Swal.fire("Account Changed", `You're now connected as ${shortenAddress(selectedAccount)}`, "info");
      // Reload assets and rounds
      loadActiveAssetsAndRounds();
      // Update connect button text
      $("#connect-wallet-btn").html(`Connected: ${shortenAddress(selectedAccount)} <i class="bi bi-box-arrow-right disconnect-icon"></i>`);
    }
  }

  /**
   * Handle chain changes (WalletConnect).
   */
  function handleChainChangedWC(chainId) {
    // Inform the user to switch networks manually
    Swal.fire("Network Changed", "Please ensure you're on the zkSync Era network.", "warning");
    // Optionally, you can reload the page or refetch data
  }

  /**
   * Handle disconnect (WalletConnect).
   */
  function handleDisconnectWC(code, reason) {
    console.log("WalletConnect disconnected:", code, reason);
    disconnectWallet();
  }

  /***************************************************
   * LOADING & DISPLAYING ASSETS & ROUNDS
   ***************************************************/
  async function loadActiveAssetsAndRounds() {
    if (!contract) return;
    // Clear existing data
    assetsData = [];

    try {
      // 1) Get total assetCount
      const assetCount = await contract.methods.assetCount().call();

      if (assetCount == 0) {
        Swal.fire("No Assets", "There are no active assets in the contract.", "info");
        return;
      }

      // 2) For each asset from 1..assetCount, check if active, gather data
      for (let i = 1; i <= assetCount; i++) {
        const assetCfg = await contract.methods.assets(i).call();
        if (!assetCfg.active) {
          continue; // Skip if not active
        }
        // assetCfg is a struct: {assetToken, interval, repeating, priceOracle, active}
        const singleAsset = {
          assetID: i,
          assetToken: assetCfg.assetToken,
          interval: assetCfg.interval,
          repeating: assetCfg.repeating,
          priceOracle: assetCfg.priceOracle,
          active: assetCfg.active,
          currentRoundID: null,
          currentRoundData: null,
        };

        // 3) Find the latest round that has started but not ended
        let foundRoundID = null;
        let foundRoundData = null;

        // Assuming round IDs start from 1 and increment
        const maxRoundToCheck = 100; // Adjust as needed
        for (let rID = 1; rID <= maxRoundToCheck; rID++) {
          let round = await contract.methods.rounds(i, rID).call();
          // round: struct {startTime, endTime, initialPrice, finalPrice, priceCaptured, ended, upPool, downPool, bearsDistributed}
          // Check if it is a "valid" round (startTime > 0) and not ended
          if (round.startTime > 0 && !round.ended) {
            foundRoundID = rID;
            foundRoundData = round;
            // Since rounds are sequential, we can break after finding the first active round
            break;
          }
        }

        if (foundRoundID) {
          singleAsset.currentRoundID = foundRoundID;
          singleAsset.currentRoundData = foundRoundData;
        }

        assetsData.push(singleAsset);
      }

      // 4) Now that we have an array of active assets, build the UI
      createAssetsUI();
      // 5) Start countdown timers
      startCountdownTimers();
    } catch (err) {
      console.error("Error loading assets/rounds:", err);
      Swal.fire("Error", "Failed to load assets and rounds. Please ensure the contract is correctly set up.", "error");
    }
  }

  /**
   * Creates the dynamic UI for listing assets and any active rounds.
   */
  function createAssetsUI() {
    // We'll place the assets UI in the main container under the existing content
    // Create a new row with ID #assets-section if it doesn't exist
    if ($("#assets-section").length === 0) {
      $(".container").append(
        `<div class="row" id="assets-section">
          <div class="col-12">
            <h3>Active Assets & Rounds</h3>
            <div id="assets-list"></div>
          </div>
        </div>`
      );
    }

    // Clear any old listings
    $("#assets-list").empty();

    if (!assetsData || assetsData.length === 0) {
      $("#assets-list").append(`<p>No active assets found.</p>`);
      return;
    }

    assetsData.forEach((asset) => {
      // Build a card-like UI for each asset
      const repeatingText = asset.repeating ? "Yes" : "No";
      const intervalText = asset.interval ? formatInterval(asset.interval) : "Not set";
      const currentRoundText = asset.currentRoundID
        ? `Round #${asset.currentRoundID}`
        : "No active round found";

      const html = `
        <div class="card my-3">
          <div class="card-body">
            <h5 class="card-title">Asset #${asset.assetID} (Token: ${asset.assetToken})</h5>
            <p>Repeating: ${repeatingText}<br/>
               Interval: ${intervalText}
            </p>
            <p><strong>Current Round:</strong> ${currentRoundText}</p>

            ${
              asset.currentRoundID && asset.currentRoundData
                ? `
                  <div class="countdown-box mt-3" id="countdown-box-${asset.assetID}">
                    <div class="countdown-part">
                      <div id="minutes-val-${asset.assetID}">--</div>
                      <div class="countdown-label">Minutes</div>
                    </div>
                    <div class="countdown-divider"></div>
                    <div class="countdown-part">
                      <div id="seconds-val-${asset.assetID}">--</div>
                      <div class="countdown-label">Seconds</div>
                    </div>
                    <div class="countdown-divider"></div>
                    <div class="countdown-description" id="cd-desc-${asset.assetID}">
                      Calculating time remaining...
                    </div>
                  </div>
                  <div class="d-flex flex-wrap gap-3 mt-3">
                    <div class="text-center">
                      <div>Predict Down</div>
                      <button class="btn btn-danger btn-sm mt-2" 
                        onclick="buyTicketDown(${asset.assetID}, ${asset.currentRoundID})">
                        Buy Ticket
                      </button>
                    </div>
                    <div class="text-center">
                      <div>Predict Up</div>
                      <button class="btn btn-success btn-sm mt-2" 
                        onclick="buyTicketUp(${asset.assetID}, ${asset.currentRoundID})">
                        Buy Ticket
                      </button>
                    </div>
                  </div>
                `
                : `<p style="color:#e06c75;">No ongoing round. Please wait or come back later.</p>`
            }
          </div>
        </div>
      `;
      $("#assets-list").append(html);
    });
  }

  /**
   * Formats the interval from seconds to a human-readable format.
   * e.g., 1800 -> "30 minutes"
   */
  function formatInterval(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    let result = "";
    if (mins > 0) result += `${mins}m `;
    if (secs > 0) result += `${secs}s`;
    return result.trim();
  }

  /**
   * Starts the countdown timers for each asset that has a current round.
   */
  function startCountdownTimers() {
    // Clear old intervals
    if (window._countdownInterval) {
      clearInterval(window._countdownInterval);
    }

    window._countdownInterval = setInterval(() => {
      // For each asset that has currentRoundData, update countdown
      assetsData.forEach((asset) => {
        if (asset.currentRoundID && asset.currentRoundData) {
          updateCountdown(asset);
        }
      });
    }, 1000);
  }

  /**
   * Updates the countdown timer for a specific asset.
   */
  function updateCountdown(asset) {
    const round = asset.currentRoundData;
    const now = Math.floor(Date.now() / 1000);
    const endTime = parseInt(round.endTime, 10);

    let remaining = endTime - now;
    if (remaining < 0) {
      remaining = 0;
    }
    let minutes = Math.floor(remaining / 60);
    let seconds = remaining % 60;

    const mID = `#minutes-val-${asset.assetID}`;
    const sID = `#seconds-val-${asset.assetID}`;
    const descID = `#cd-desc-${asset.assetID}`;

    $(mID).text(minutes.toString().padStart(2, "0"));
    $(sID).text(seconds.toString().padStart(2, "0"));

    if (remaining === 0) {
      $(descID).text("Round ended or about to end!");
      // Optionally, refresh the asset data to reflect the ended round
      loadActiveAssetsAndRounds();
    } else {
      $(descID).text(`until Price Session Resolution`);
    }
  }

  /***************************************************
   * BUY TICKET (Up/Down)
   ***************************************************/
  // Define global functions so they're accessible from inline onClick attributes
  window.buyTicketUp = async function (assetID, roundID) {
    await buyTicket(assetID, roundID, true, 1); // Default to 1 ticket
  };

  window.buyTicketDown = async function (assetID, roundID) {
    await buyTicket(assetID, roundID, false, 1); // Default to 1 ticket
  };

  /**
   * Buys a ticket for Predict Up or Predict Down.
   * @param {number} assetID - The ID of the asset.
   * @param {number} roundID - The ID of the round.
   * @param {boolean} predictUp - True for Predict Up, False for Predict Down.
   * @param {number} ticketCount - Number of tickets to buy.
   */
  async function buyTicket(assetID, roundID, predictUp, ticketCount) {
    if (!isConnected) {
      Swal.fire("Not Connected", "Please connect your wallet first.", "warning");
      return;
    }
    try {
      // Prompt the user for the number of tickets
      const { value: tickets } = await Swal.fire({
        title: 'Buy Tickets',
        input: 'number',
        inputLabel: 'Number of tickets',
        inputPlaceholder: 'Enter number of tickets',
        inputAttributes: {
          min: 1,
          step: 1
        },
        showCancelButton: true,
        inputValidator: (value) => {
          if (!value || value < 1) {
            return 'You need to enter at least 1 ticket!';
          }
        }
      });

      if (!tickets) {
        return; // User canceled
      }

      const ticketCountParsed = parseInt(tickets, 10);

      // Interact with the contract
      const tx = await contract.methods
        .buyTicket(assetID, roundID, predictUp, ticketCountParsed)
        .send({ from: selectedAccount });

      Swal.fire("Success", `Tickets purchased! TX Hash: ${tx.transactionHash}`, "success");

      // Refresh the assets and rounds data
      await loadActiveAssetsAndRounds();
    } catch (err) {
      console.error("buyTicket error:", err);
      Swal.fire("Error", err.message, "error");
    }
  }

  /**
   * Shortens an Ethereum address for display purposes.
   * @param {string} address - The Ethereum address.
   * @returns {string} - Shortened address.
   */
  function shortenAddress(address) {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /***************************************************
   * DISCONNECT FUNCTIONALITY
   ***************************************************/
  // The disconnect functionality is already handled in the 'disconnectWallet' function above,
  // which is triggered via the connect button when already connected.
  // No additional code is needed here.

  /***************************************************
   * EXPOSE CONTRACT GLOBALALLY FOR ADMIN USE
   ***************************************************/
  // After the contract is initialized and connected, it's exposed globally.
  // This is handled in the connectWithMetaMask and connectWithWalletConnect functions.
  // Example: window.contract = contract;

  /***************************************************
   * EVENTS LISTENERS AND CLEANUP
   ***************************************************/
  // Already handled in the connect functions and disconnectWallet.

  /***************************************************
   * OTHER HELPER FUNCTIONS
   ***************************************************/
  // Add any additional helper functions here as needed.

  /***************************************************
   * THE END - All user-oriented logic is here.
   ***************************************************/
});
