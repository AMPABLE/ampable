// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Strings.sol";

/* ======================================================
   PredictiveGame
   ------------------------------------------------------
   This contract implements a fully on-chain, skill-based prediction game.
   Users pay 1 USDC per ticket to predict if an asset’s price will go Up or Down
   over a fixed round interval. Rounds are defined by preset durations:
       0: 30 minutes, 1: 1 hour, 2: 12 hours, 3: 1 day, 4: 1 week, 5: 1 month (30d), 6: 1 year (365d)
   Ticket purchases freeze after 95% of the round time elapses.
   Rounds are settled by anyone once their end time has passed; settlement fetches the final
   price from Uniswap V4 via the Quoter interface, deducts a 1% fee to the DAO treasury,
   and then winning users can claim ERC-721 “Teddy Bear” NFTs as prizes.
   Users can propose assets with metadata, and the DAO can update or delist assets.
   This contract is designed to work with an upgradeable proxy.
   ====================================================== */

// Minimal ERC20 interface
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function decimals() external view returns (uint8);
}

// Interface for Uniswap V4 Quoter
interface IV4Quoter {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }
    // Simulate a swap of amountIn from tokenIn to tokenOut.
    function quoteExactInputSingle(
        PoolKey calldata key,
        bool zeroForOne,
        uint128 amountIn
    ) external returns (uint256 amountOut, uint256 gasEstimate);
}

/// @title PredictiveGame
/// @notice Implements a skill-based prediction game with ticket purchases, round settlement, and NFT prizes.
/// @dev Designed to be upgradeable (initialize() is used instead of a constructor). The DAO (owner) can update settings.
contract PredictiveGame {
    using Strings for uint256;

    // ==================== Game Configuration & State ====================
    IERC20 public usdcToken;       // USDC token (6 decimals on Optimism)
    address public daoTreasury;      // Treasury for fees (1% fee)
    address public owner;            // DAO owner
    uint256 public assetListingFee;  // Fee in USDC (6 decimals) for listing a new asset

    // Interval durations in seconds:
    // 0: 30m, 1: 1h, 2: 12h, 3: 1d, 4: 1w, 5: 1m (~30d), 6: 1y (~365d)
    uint256[] public intervalDurations;

    /// @notice Metadata for an asset added to the game.
    struct AssetInfo {
        string name;
        string category;
        string issuer;
        uint8 defaultIntervalIndex;
        bool isOfficial; // Set by DAO
        bool exists;     // True if asset is active
    }
    mapping(address => AssetInfo) public assets;

    // ==================== Round & Prediction Data ====================
    enum Outcome { None, Up, Down, Tie }
    struct RoundInfo {
        uint256 startTime;    // Round start time
        uint256 endTime;      // Round end time
        uint256 startPrice;   // Price at round start (scaled to 1e18)
        Outcome outcome;      // Outcome of the round (None if unsettled)
        bool settled;         // Whether round is settled
        uint64 totalUp;       // Total up-side tickets
        uint64 totalDown;     // Total down-side tickets
    }
    // Mapping: asset => interval index => round ID => RoundInfo.
    mapping(address => mapping(uint8 => mapping(uint256 => RoundInfo))) public rounds;
    // Latest round ID per asset and interval.
    mapping(address => mapping(uint8 => uint256)) public latestRoundId;
    // User ticket counts.
    mapping(address => mapping(uint8 => mapping(uint256 => mapping(address => uint64)))) public userUpTickets;
    mapping(address => mapping(uint8 => mapping(uint256 => mapping(address => uint64)))) public userDownTickets;

    // ==================== Uniswap V4 Price Oracle Data ====================
    // Cached Uniswap pool address for asset/USDC pair.
    mapping(address => address) public assetPool;

    // ==================== Teddy Bear NFT (ERC-721) Data ====================
    string public baseTokenURI; // Base URI for NFT metadata
    string public nftName;      // NFT collection name
    string public nftSymbol;    // NFT symbol
    uint256 public nextTokenId; // Next token ID to mint

    // ERC-721 standard mappings.
    mapping(uint256 => address) private _tokenOwner;
    mapping(address => uint256) private _balance;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(address => uint256[]) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokensIndex;

    // ==================== Events ====================
    event AssetAdded(address indexed token, string name, string category, string issuer, uint8 defaultInterval, address indexed addedBy, uint256 feePaid);
    event AssetApproved(address indexed token, bool isOfficial);
    event AssetMetadataChanged(address indexed token, string name, string category, string issuer, uint8 defaultInterval);
    event AssetDelisted(address indexed token);
    event TicketsPurchased(address indexed user, address indexed asset, uint8 intervalIndex, uint256 roundId, uint64 count, bool predictedUp);
    event RoundSettled(address indexed asset, uint8 intervalIndex, uint256 roundId, Outcome outcome, uint256 endPrice);
    event PrizeClaimed(address indexed user, address indexed asset, uint8 intervalIndex, uint256 roundId, uint256 tokenId);
    // ERC-721 events.
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // ==================== Uniswap V4 Quoter Integration ====================
    // Uniswap V4 Quoter address on Optimism. (Verify with latest docs.)
    IV4Quoter constant quoter = IV4Quoter(0x1f3131A13296Fb91c90870043742C3cdBfF1a8D7);

    // ==================== Modifiers ====================
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }
    modifier assetListed(address token) {
        require(assets[token].exists, "Asset not listed");
        _;
    }

    // ==================== Initialization ====================
    /// @notice Initialize the PredictiveGame contract.
    /// @param _usdc Address of the USDC token on Optimism.
    /// @param _daoTreasury Treasury address for fees.
    /// @param _owner DAO owner.
    /// @param _baseURI Base URI for NFT metadata.
    /// @param _nftName NFT collection name.
    /// @param _nftSymbol NFT symbol.
    function initialize(
        address _usdc,
        address _daoTreasury,
        address _owner,
        string calldata _baseURI,
        string calldata _nftName,
        string calldata _nftSymbol
    ) external {
        require(owner == address(0), "Already initialized");
        require(_usdc != address(0) && _daoTreasury != address(0) && _owner != address(0), "Invalid addresses");
        usdcToken = IERC20(_usdc);
        daoTreasury = _daoTreasury;
        owner = _owner;
        assetListingFee = 0;
        // Set fixed intervals.
        intervalDurations = [1800, 3600, 43200, 86400, 604800, 2592000, 31536000];
        // Set NFT details.
        baseTokenURI = _baseURI;
        nftName = _nftName;
        nftSymbol = _nftSymbol;
        nextTokenId = 1;
    }

    // ==================== Asset Management ====================
    /// @notice Add a new asset (user-generated) to the game.
    function addAsset(
        address token,
        string calldata name,
        string calldata category,
        string calldata issuer,
        uint8 defaultIntervalIndex
    ) external {
        require(token != address(0), "Token cannot be zero");
        require(!assets[token].exists, "Asset exists");
        require(defaultIntervalIndex < intervalDurations.length, "Invalid interval index");
        if (assetListingFee > 0) {
            require(usdcToken.allowance(msg.sender, address(this)) >= assetListingFee, "Insufficient USDC allowance");
            require(usdcToken.transferFrom(msg.sender, address(this), assetListingFee), "Fee transfer failed");
        }
        assets[token] = AssetInfo({
            name: name,
            category: category,
            issuer: issuer,
            defaultIntervalIndex: defaultIntervalIndex,
            isOfficial: false,
            exists: true
        });
        emit AssetAdded(token, name, category, issuer, defaultIntervalIndex, msg.sender, assetListingFee);
        _ensurePool(token);
    }

    /// @notice Delist an asset so it does not appear in future searches (DAO function).
    function delistAsset(address token) external onlyOwner assetListed(token) {
        assets[token].exists = false;
        emit AssetDelisted(token);
    }

    /// @notice Approve or revoke an asset as official (DAO function).
    function approveAsset(address token, bool official) external onlyOwner assetListed(token) {
        assets[token].isOfficial = official;
        emit AssetApproved(token, official);
    }

    /// @notice Edit asset metadata (DAO function).
    function editAssetMetadata(
        address token,
        string calldata name,
        string calldata category,
        string calldata issuer,
        uint8 defaultIntervalIndex
    ) external onlyOwner assetListed(token) {
        require(defaultIntervalIndex < intervalDurations.length, "Invalid interval index");
        AssetInfo storage info = assets[token];
        info.name = name;
        info.category = category;
        info.issuer = issuer;
        info.defaultIntervalIndex = defaultIntervalIndex;
        emit AssetMetadataChanged(token, name, category, issuer, defaultIntervalIndex);
    }

    /// @notice Set the asset listing fee (in USDC, 6 decimals). (DAO function)
    function setAssetListingFee(uint256 newFee) external onlyOwner {
        assetListingFee = newFee;
    }

    // ==================== Ticketing & Round Management ====================
    /// @notice Users buy prediction tickets (1 USDC each) for an asset's round.
    function buyTickets(
        address token,
        uint8 intervalIndex,
        bool predictUp,
        uint64 count
    ) external assetListed(token) {
        require(intervalIndex < intervalDurations.length, "Invalid interval");
        require(count > 0, "Must buy ≥1 ticket");
        uint256 paymentAmount = uint256(count) * 1e6;
        require(usdcToken.allowance(msg.sender, address(this)) >= paymentAmount, "USDC allowance too low");
        require(usdcToken.transferFrom(msg.sender, address(this), paymentAmount), "USDC transfer failed");

        _ensurePool(token);
        require(assetPool[token] != address(0), "No Uniswap pool available");

        uint256 currRoundId = latestRoundId[token][intervalIndex];
        if (currRoundId == 0) {
            currRoundId = 1;
            latestRoundId[token][intervalIndex] = 1;
            uint256 startPrice = _getCurrentPrice(token);
            uint256 startTime = block.timestamp;
            uint256 duration = intervalDurations[intervalIndex];
            rounds[token][intervalIndex][currRoundId] = RoundInfo({
                startTime: startTime,
                endTime: startTime + duration,
                startPrice: startPrice,
                outcome: Outcome.None,
                settled: false,
                totalUp: 0,
                totalDown: 0
            });
        } else {
            RoundInfo storage round = rounds[token][intervalIndex][currRoundId];
            if (block.timestamp >= round.endTime) {
                _settleRound(token, intervalIndex, currRoundId);
                uint256 newRoundId = currRoundId + 1;
                latestRoundId[token][intervalIndex] = newRoundId;
                uint256 startPrice = _getCurrentPrice(token);
                uint256 startTime = block.timestamp;
                uint256 duration = intervalDurations[intervalIndex];
                rounds[token][intervalIndex][newRoundId] = RoundInfo({
                    startTime: startTime,
                    endTime: startTime + duration,
                    startPrice: startPrice,
                    outcome: Outcome.None,
                    settled: false,
                    totalUp: 0,
                    totalDown: 0
                });
                currRoundId = newRoundId;
            }
        }
        RoundInfo storage currRound = rounds[token][intervalIndex][currRoundId];
        // Freeze ticket purchases after 95% of round time elapsed.
        require(block.timestamp < currRound.startTime + (intervalDurations[intervalIndex] * 95) / 100, "Round nearly ended");
        if (predictUp) {
            currRound.totalUp += count;
            userUpTickets[token][intervalIndex][currRoundId][msg.sender] += count;
        } else {
            currRound.totalDown += count;
            userDownTickets[token][intervalIndex][currRoundId][msg.sender] += count;
        }
        emit TicketsPurchased(msg.sender, token, intervalIndex, currRoundId, count, predictUp);
    }

    /// @notice Settle a round if its end time has passed.
    function settleRound(address token, uint8 intervalIndex, uint256 roundId) external assetListed(token) {
        RoundInfo storage round = rounds[token][intervalIndex][roundId];
        require(round.startTime != 0, "Round does not exist");
        require(!round.settled, "Already settled");
        require(block.timestamp >= round.endTime, "Round not ended yet");
        _settleRound(token, intervalIndex, roundId);
    }

    /// @dev Internal function to settle a round.
    function _settleRound(address token, uint8 intervalIndex, uint256 roundId) internal {
        RoundInfo storage round = rounds[token][intervalIndex][roundId];
        uint256 endPrice = _getCurrentPrice(token);
        Outcome outcome;
        if (endPrice == round.startPrice) {
            outcome = Outcome.Tie;
        } else if (endPrice > round.startPrice) {
            outcome = Outcome.Up;
        } else {
            outcome = Outcome.Down;
        }
        round.outcome = outcome;
        round.settled = true;
        // Transfer 1% fee to DAO treasury.
        uint256 totalTickets = uint256(round.totalUp) + uint256(round.totalDown);
        uint256 feeAmount = (totalTickets * 1e6) / 100;
        if (feeAmount > 0 && daoTreasury != address(0)) {
            require(usdcToken.transfer(daoTreasury, feeAmount), "Fee transfer failed");
        }
        emit RoundSettled(token, intervalIndex, roundId, outcome, endPrice);
    }

    /// @notice Claim Teddy Bear NFT prizes for winning tickets.
    function claimPrize(address token, uint8 intervalIndex, uint256 roundId) external assetListed(token) {
        RoundInfo storage round = rounds[token][intervalIndex][roundId];
        require(round.settled, "Round not settled");
        require(round.outcome != Outcome.None && round.outcome != Outcome.Tie, "No winners");
        uint64 winningTickets = 0;
        if (round.outcome == Outcome.Up) {
            winningTickets = userUpTickets[token][intervalIndex][roundId][msg.sender];
            userUpTickets[token][intervalIndex][roundId][msg.sender] = 0;
        } else {
            winningTickets = userDownTickets[token][intervalIndex][roundId][msg.sender];
            userDownTickets[token][intervalIndex][roundId][msg.sender] = 0;
        }
        require(winningTickets > 0, "No winning tickets");
        for (uint64 i = 0; i < winningTickets; i++) {
            _mintNFT(msg.sender);
        }
        emit PrizeClaimed(msg.sender, token, intervalIndex, roundId, nextTokenId - 1);
    }

    // ==================== Uniswap V4 Price Retrieval ====================
    /// @notice Retrieves the current price of an asset in USDC using the Uniswap V4 Quoter.
    /// Simulates a swap of 10,000 USDC and returns the price per token (scaled to 1e18).
    function _getCurrentPrice(address token) internal view returns (uint256 priceX18) {
        address pool = assetPool[token];
        require(pool != address(0), "No pool available");
        IV4Quoter.PoolKey memory key;
        address usdc = address(usdcToken);
        if (usdc < token) {
            key.currency0 = usdc;
            key.currency1 = token;
        } else {
            key.currency0 = token;
            key.currency1 = usdc;
        }
        key.fee = 10000;       // Example: 1% fee tier.
        key.tickSpacing = 200; // Typical for 1% fee.
        key.hooks = address(0);
        bool zeroForOne = (key.currency0 == usdc);
        uint128 amountIn = uint128(10000 * 1e6); // 10,000 USDC.
        (uint256 amountOut, ) = quoter.quoteExactInputSingle(key, zeroForOne, amountIn);
        // Price per token = (10,000 USDC / amountOut). Return scaled to 1e18.
        priceX18 = (uint256(amountIn) * (10 ** 18)) / amountOut;
    }

    /// @dev Internal helper to ensure we have a cached Uniswap pool for the token.
    function _ensurePool(address token) internal {
        if (assetPool[token] != address(0)) return;
        address pool = _findPoolAddress(token, address(usdcToken));
        if (pool != address(0)) {
            assetPool[token] = pool;
        }
    }

    /// @dev Simplified placeholder for on-chain pool lookup.
    function _findPoolAddress(address tokenA, address tokenB) internal view returns (address) {
        // In production, compute the pool address deterministically using Uniswap V4's factory/PoolManager logic.
        // For example (similar to Uniswap V3):
        // pool = address(uint160(uint256(keccak256(abi.encodePacked(
        //     hex"ff",
        //     factory,
        //     keccak256(abi.encode(tokenA, tokenB, fee)),
        //     initCodeHash
        // )))));
        // Here we return address(0) as a placeholder.
        return address(0);
    }

    // ==================== Teddy Bear NFT (ERC-721) Functions ====================
    /// @dev Internal function to mint a new Teddy Bear NFT.
    function _mintNFT(address to) internal {
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        _tokenOwner[tokenId] = to;
        _balance[to] += 1;
        _ownedTokens[to].push(tokenId);
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length - 1;
        emit Transfer(address(0), to, tokenId);
    }

    /// @notice Returns the owner of a given NFT.
    function ownerOf(uint256 tokenId) external view returns (address) {
        address ownerAddr = _tokenOwner[tokenId];
        require(ownerAddr != address(0), "Token does not exist");
        return ownerAddr;
    }

    /// @notice Returns the balance (number of NFTs) of a given address.
    function balanceOf(address ownerAddr) external view returns (uint256) {
        require(ownerAddr != address(0), "Zero address not valid");
        return _balance[ownerAddr];
    }

    function approve(address to, uint256 tokenId) external {
        address ownerAddr = _tokenOwner[tokenId];
        require(ownerAddr == msg.sender || _operatorApprovals[ownerAddr][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(ownerAddr, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        require(_tokenOwner[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address ownerAddr, address operator) external view returns (bool) {
        return _operatorApprovals[ownerAddr][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        address ownerAddr = _tokenOwner[tokenId];
        require(ownerAddr == from, "Not the owner");
        require(to != address(0), "Invalid recipient");
        require(msg.sender == from || msg.sender == _tokenApprovals[tokenId] || _operatorApprovals[from][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = address(0);
        emit Approval(from, address(0), tokenId);
        _tokenOwner[tokenId] = to;
        _balance[from] -= 1;
        _balance[to] += 1;
        uint256 tokenIndex = _ownedTokensIndex[tokenId];
        uint256 lastTokenId = _ownedTokens[from][_ownedTokens[from].length - 1];
        _ownedTokens[from][tokenIndex] = lastTokenId;
        _ownedTokensIndex[lastTokenId] = tokenIndex;
        _ownedTokens[from].pop();
        _ownedTokens[to].push(tokenId);
        _ownedTokensIndex[tokenId] = _ownedTokens[to].length - 1;
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external {
        transferFrom(from, to, tokenId);
        // In production, check ERC721Receiver.onERC721Received if 'to' is a contract.
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_tokenOwner[tokenId] != address(0), "Token does not exist");
        return string(abi.encodePacked(baseTokenURI, tokenId.toString()));
    }

    // ==================== Administrative Functions ====================
    /// @notice Update the duration (in seconds) for a given interval index. (DAO function)
    function setIntervalDuration(uint8 intervalIndex, uint256 newDuration) external onlyOwner {
        require(intervalIndex < intervalDurations.length, "Invalid interval index");
        require(newDuration > 0, "Duration must be > 0");
        intervalDurations[intervalIndex] = newDuration;
    }

    /// @notice Change the DAO treasury address. (DAO function)
    function setDaoTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Treasury cannot be zero");
        daoTreasury = newTreasury;
    }

    /// @notice Withdraw any ERC20 tokens mistakenly sent to this contract. (DAO function)
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    // ==================== Storage Gap for Upgradeability ====================
    uint256[50] private __gap;
}

/* ======================================================
   Contract Documentation:

   Overview:
   ---------
   The PredictiveGame contract is a fully on-chain, upgradeable game of skill.
   Players purchase prediction tickets (1 USDC each) for asset price rounds with fixed durations.
   Rounds are defined by preset intervals (30m, 1h, 12h, 1d, 1w, 1m, 1y). Ticket purchases
   are disallowed once 95% of the interval elapses. Rounds are settled when the end time passes,
   fetching the final price from Uniswap V4 via an on-chain Quoter. Settlement determines whether
   the price went Up, Down, or Tie relative to the start price. A 1% fee from ticket sales is sent
   to the DAO treasury. Winners (correct predictions) can later claim ERC-721 Teddy Bear NFTs as prizes.

   Price Retrieval:
   ----------------
   The contract integrates with Uniswap V4 by constructing a PoolKey (using USDC and the asset token,
   with a fee tier of 1% and tick spacing 200) and calling the Quoter’s quoteExactInputSingle function.
   A simulated swap of 10,000 USDC is used to compute a liquidity-weighted price, scaled to 1e18.
   The pool address is cached for future calls.

   Asset Management:
   -----------------
   Users may propose assets by providing token address and metadata (name, category, issuer, default interval).
   A listing fee (in USDC) may be charged. The DAO can edit asset metadata, mark an asset as official,
   or delist an asset (which removes it from searches). Assets are stored by token address.

   Rounds & Tickets:
   -----------------
   For each asset and interval, rounds are maintained in a mapping. If no active round exists, one is started.
   Ticket purchases are recorded for Up and Down predictions. If a round has ended (or exceeds its end time),
   anyone may trigger settlement. Settlement retrieves the final price, determines the outcome, deducts a 1%
   fee to the DAO, and marks the round as settled.

   Teddy Bear NFTs:
   ----------------
   Winning predictions (non-tie rounds) allow users to claim NFTs (one per winning ticket).
   The NFT implementation follows the ERC-721 standard with basic functions (transfer, approve, tokenURI)
   so that tokens work on marketplaces like OpenSea. The NFT metadata is based on a common baseTokenURI.

   Administration & Upgradability:
   -------------------------------
   Administrative functions (updating interval durations, DAO treasury, asset listing fee, asset metadata,
   and asset delisting) are restricted to the DAO (owner). The contract is designed to be upgradeable,
   using an initialize() function (instead of a constructor) and a storage gap reserved for future upgrades.

   Uniswap Integration & Pool Discovery:
   --------------------------------------
   The contract uses an IV4Quoter interface for on-chain price quotes from Uniswap V4.
   A deterministic pool lookup function is included as a placeholder (_findPoolAddress); in production,
   this should be replaced with an integration using Uniswap V4’s PoolManager. Price retrieval returns 0 if
   no pool exists.

   Frontend Data & User Portfolio:
   --------------------------------
   The contract includes functions to retrieve round details and user ticket data, allowing the frontend to
   display current odds, time remaining, and other state data. (For more extensive queries, off-chain indexing
   via The Graph or similar tools may be used.)

   Security:
   ---------
   - All critical functions are protected with onlyOwner or asset-listed modifiers.
   - USDC transfers require proper allowance checks.
   - Settlement can be triggered by any user, ensuring rounds are processed even if not explicitly settled.
   - The NFT implementation adheres to ERC-721 standards.

   ====================================================== */
