// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title TeddyBearPrediction
 * @notice A skill-based prediction platform where participants buy tickets to predict asset value changes.
 *         Winners receive Teddy Bear NFTs, which can be sold back for USDC.
 *
 * KEY FEATURES:
 * - Time-based rounds for assets (e.g., 30 minutes or 1 year).
 * - Ticket price linearly increases from 5 USDC to nearly 10 USDC at 95% elapsed time.
 * - Winners redeem tickets for Teddy Bear NFTs at end of round, each convertible to ~10 USDC.
 * - Maintainer/DAO controls fees, oracle addresses, and asset approvals.
 * - Transparent, skill-based game inspired by fairground teddy bear prizes.
 *
 * DISCLAIMER: This is a draft prototype. Subject to change. For testing/educational use only.
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

// Minimal ERC721 interface
interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

// Price oracle interface: returns price in USDC (6 decimals)
interface IPriceOracle {
    function getPrice(address asset) external view returns (uint256);
}

contract TeddyBearPrediction is Context, ReentrancyGuard, ERC165 {
    using SafeERC20 for IERC20;

    // -----------------------
    // Roles and Addresses
    // -----------------------
    address public maintainer;       // Initially deployer, eventually DAO
    address public daoTreasury;      // Receives fees

    // -----------------------
    // Constants and Limits
    // -----------------------
    uint256 public constant MAX_FEE_BPS = 1000; // 10%
    uint256 public constant USDC_DECIMALS = 1e6; // 1 USDC = 10^6
    uint256 public constant BASE_TICKET_PRICE = 5 * USDC_DECIMALS; // 5 USDC
    uint256 public constant MAX_TICKET_PRICE = 10 * USDC_DECIMALS; // 10 USDC
    uint256 public constant CUTOFF_PERCENT_BPS = 9500; // 95%
    uint256 public constant TEDDY_BEAR_BASE_PRICE = 10 * USDC_DECIMALS; // 10 USDC per NFT

    // -----------------------
    // Fees
    // -----------------------
    // Fees in basis points: e.g. 300 = 3%
    uint256 public teddyBearFeeBps = 300; // default 3%
    uint256 public ticketFeeBps = 0;      // default 0%

    // -----------------------
    // Asset and Round Structs
    // -----------------------
    struct AssetConfig {
        address assetToken;   // token representing the asset (could be WBTC, or a real-world asset token)
        uint256 interval;     // length of the prediction period in seconds
        bool repeating;       // whether rounds repeat automatically or one-time
        address priceOracle;  // oracle to fetch price (USDC equivalent)
        bool active;          // active or not
    }

    struct Round {
        uint256 startTime;
        uint256 endTime;
        uint256 initialPrice;   // in USDC units
        uint256 finalPrice;     // in USDC units
        bool priceCaptured;
        bool ended;
        uint256 upPool;         // total USDC from Up predictions
        uint256 downPool;       // total USDC from Down predictions
        bool bearsDistributed;
    }

    // -----------------------
    // Storage
    // -----------------------
    IERC20 public usdc;

    uint256 public assetCount;
    mapping(uint256 => AssetConfig) public assets;

    // Each asset can have multiple rounds
    // assetID => roundID => Round
    mapping(uint256 => mapping(uint256 => Round)) public rounds;

    // User stakes: user => assetID => roundID
    mapping(address => mapping(uint256 => mapping(uint256 => uint256))) public userUpStakes;
    mapping(address => mapping(uint256 => mapping(uint256 => uint256))) public userDownStakes;

    // Mapping of proposed assets waiting for approval
    struct AssetProposal {
        address assetToken;
        uint256 interval;
        bool repeating;
        address priceOracle;
        bool proposed;
    }
    uint256 public proposalCount;
    mapping(uint256 => AssetProposal) public proposals;

    // Teddy Bear NFT logic
    // A simple ERC721-like minting: each winner gets 1 NFT per winning ticket.
    // We'll track:
    uint256 private _nextTeddyId;
    mapping(uint256 => address) private _teddyOwner; // tokenId => owner
    mapping(address => uint256) private _teddyBalance;
    // No metadata on-chain for simplicity, would normally have tokenURI logic.
    // Burn on sell-back.

    // -----------------------
    // Events
    // -----------------------
    event MaintainerChanged(address indexed oldMaintainer, address indexed newMaintainer);
    event DaoTreasuryChanged(address indexed oldDao, address indexed newDao);
    event FeeChanged(uint256 teddyBearFeeBps, uint256 ticketFeeBps);
    event AssetProposed(uint256 proposalId, address assetToken, uint256 interval, bool repeating, address oracle);
    event AssetApproved(uint256 assetID, address assetToken, uint256 interval, bool repeating, address oracle);
    event AssetActivated(uint256 assetID, bool active);
    event OracleChanged(uint256 assetID, address newOracle);
    event RoundStarted(uint256 assetID, uint256 roundID, uint256 startTime, uint256 endTime);
    event TicketPurchased(address indexed user, uint256 assetID, uint256 roundID, bool up, uint256 amountPaid);
    event RoundEnded(uint256 assetID, uint256 roundID, uint256 finalPrice);
    event BearsDistributed(uint256 assetID, uint256 roundID);
    event TeddyBearSold(address indexed user, uint256 teddyId, uint256 usdcReceived);
    event TeddyBearMinted(address indexed user, uint256 teddyId);
    event TicketsRedeemedForBears(address indexed user, uint256 assetID, uint256 roundID, uint256 ticketsRedeemed);
    event TokensWithdrawn(address indexed token, uint256 amount);
    event ETHWithdrawn(uint256 amount);

    // -----------------------
    // Modifiers
    // -----------------------
    modifier onlyMaintainer() {
        require(_msgSender() == maintainer, "Not maintainer");
        _;
    }

    // -----------------------
    // Constructor
    // -----------------------
    constructor(address _usdc, address _daoTreasury) ERC165() {
        require(_usdc != address(0), "Invalid USDC address");
        require(_daoTreasury != address(0), "Invalid DAO treasury address");

        maintainer = _msgSender();
        daoTreasury = _daoTreasury;
        usdc = IERC20(_usdc);
    }

    // -----------------------
    // Admin Functions
    // -----------------------
    function transferMaintainer(address newMaintainer) external onlyMaintainer {
        require(newMaintainer != address(0), "Zero address");
        emit MaintainerChanged(maintainer, newMaintainer);
        maintainer = newMaintainer;
    }

    function setDaoTreasury(address newDao) external onlyMaintainer {
        require(newDao != address(0), "Zero address");
        emit DaoTreasuryChanged(daoTreasury, newDao);
        daoTreasury = newDao;
    }

    function setFees(uint256 _teddyBearFeeBps, uint256 _ticketFeeBps) external onlyMaintainer {
        require(_teddyBearFeeBps <= MAX_FEE_BPS, "Fee too high");
        require(_ticketFeeBps <= MAX_FEE_BPS, "Fee too high");
        teddyBearFeeBps = _teddyBearFeeBps;
        ticketFeeBps = _ticketFeeBps;
        emit FeeChanged(teddyBearFeeBps, ticketFeeBps);
    }

    function proposeAssetConfig(address assetToken, uint256 interval, bool repeating, address oracle) external {
        require(assetToken != address(0), "Invalid asset");
        require(oracle != address(0), "Invalid oracle");
        require(interval > 0, "Interval required");
        proposalCount++;
        proposals[proposalCount] = AssetProposal({
            assetToken: assetToken,
            interval: interval,
            repeating: repeating,
            priceOracle: oracle,
            proposed: true
        });
        emit AssetProposed(proposalCount, assetToken, interval, repeating, oracle);
    }

    function approveAssetConfig(uint256 proposalId) external onlyMaintainer {
        AssetProposal storage p = proposals[proposalId];
        require(p.proposed, "No proposal");
        assetCount++;
        assets[assetCount] = AssetConfig({
            assetToken: p.assetToken,
            interval: p.interval,
            repeating: p.repeating,
            priceOracle: p.priceOracle,
            active: true
        });
        emit AssetApproved(assetCount, p.assetToken, p.interval, p.repeating, p.priceOracle);
        delete proposals[proposalId]; // clear proposal
    }

    function setAssetActive(uint256 assetID, bool active) external onlyMaintainer {
        require(assetID > 0 && assetID <= assetCount, "Invalid assetID");
        assets[assetID].active = active;
        emit AssetActivated(assetID, active);
    }

    function setAssetOracle(uint256 assetID, address newOracle) external onlyMaintainer {
        require(assetID > 0 && assetID <= assetCount, "Invalid assetID");
        require(newOracle != address(0), "Zero oracle");
        assets[assetID].priceOracle = newOracle;
        emit OracleChanged(assetID, newOracle);
    }

    // -----------------------
    // Core Functions
    // -----------------------

    function startRound(uint256 assetID, uint256 roundID, uint256 startTime) external onlyMaintainer {
        AssetConfig memory config = assets[assetID];
        require(config.active, "Asset not active");
        require(rounds[assetID][roundID].startTime == 0, "Round exists");
        uint256 endTime = startTime + config.interval;
        rounds[assetID][roundID] = Round({
            startTime: startTime,
            endTime: endTime,
            initialPrice: 0,
            finalPrice: 0,
            priceCaptured: false,
            ended: false,
            upPool: 0,
            downPool: 0,
            bearsDistributed: false
        });

        emit RoundStarted(assetID, roundID, startTime, endTime);
    }

    function buyTicket(uint256 assetID, uint256 roundID, bool predictUp, uint256 ticketCount) external nonReentrant {
        require(ticketCount > 0, "No tickets");
        Round storage r = rounds[assetID][roundID];
        require(r.startTime > 0, "Round not started");
        require(block.timestamp >= r.startTime, "Too early");
        require(!r.ended, "Round ended");

        AssetConfig memory config = assets[assetID];
        require(config.active, "Inactive asset");

        uint256 elapsed = block.timestamp - r.startTime;
        if (elapsed * 10000 / config.interval >= CUTOFF_PERCENT_BPS) {
            revert("Past cutoff time");
        }

        // Calculate ticket price
        uint256 cutoffTime = (config.interval * CUTOFF_PERCENT_BPS) / 10000;
        if (elapsed > cutoffTime) {
            elapsed = cutoffTime;
        }
        // p(t) = 5 USDC + (5 USDC * elapsed / cutoffTime)
        // Using integer math:
        uint256 variablePart = (5 * USDC_DECIMALS * elapsed) / cutoffTime; // 5 * USDC_DECIMALS = 5e6
        uint256 currentTicketPrice = BASE_TICKET_PRICE + variablePart; // ranges from 5e6 to almost 10e6

        uint256 totalCost = currentTicketPrice * ticketCount;
        uint256 fee = (totalCost * ticketFeeBps) / 10000;
        uint256 amountAfterFee = totalCost - fee;

        // If first purchase, capture initial price
        if (!r.priceCaptured) {
            r.priceCaptured = true;
            r.initialPrice = getPriceFromOracle(config.priceOracle, config.assetToken);
        }

        // Transfer funds
        usdc.safeTransferFrom(_msgSender(), address(this), totalCost);
        if (fee > 0) {
            usdc.safeTransfer(daoTreasury, fee);
        }

        if (predictUp) {
            r.upPool += amountAfterFee;
            userUpStakes[_msgSender()][assetID][roundID] += amountAfterFee;
        } else {
            r.downPool += amountAfterFee;
            userDownStakes[_msgSender()][assetID][roundID] += amountAfterFee;
        }

        emit TicketPurchased(_msgSender(), assetID, roundID, predictUp, totalCost);
    }

    function endRound(uint256 assetID, uint256 roundID) external {
        Round storage r = rounds[assetID][roundID];
        require(!r.ended, "Already ended");
        require(r.startTime > 0, "No round");
        require(block.timestamp >= r.endTime, "Not ended yet");
        r.ended = true;

        AssetConfig memory config = assets[assetID];
        r.finalPrice = getPriceFromOracle(config.priceOracle, config.assetToken);

        emit RoundEnded(assetID, roundID, r.finalPrice);
    }

    function redeemTicketsForBears(uint256 assetID, uint256 roundID) external nonReentrant {
        Round storage r = rounds[assetID][roundID];
        require(r.ended, "Round not ended");
        require(r.priceCaptured, "No price captured");

        bool upWins = (r.finalPrice > r.initialPrice);
        uint256 userStake;
        if (upWins) {
            userStake = userUpStakes[_msgSender()][assetID][roundID];
            require(userStake > 0, "No winning stake");
            userUpStakes[_msgSender()][assetID][roundID] = 0;
        } else {
            userStake = userDownStakes[_msgSender()][assetID][roundID];
            require(userStake > 0, "No winning stake");
            userDownStakes[_msgSender()][assetID][roundID] = 0;
        }

        // 1 Teddy Bear per 1 USDC staked
        uint256 bearsToMint = userStake / USDC_DECIMALS;
        require(bearsToMint > 0, "No bears to redeem");

        // Mint Teddy Bears
        for (uint256 i = 0; i < bearsToMint; i++) {
            _mintTeddy(_msgSender());
        }

        emit TicketsRedeemedForBears(_msgSender(), assetID, roundID, bearsToMint);
    }

    function distributeBears(uint256 assetID, uint256 roundID) external onlyMaintainer {
        Round storage r = rounds[assetID][roundID];
        require(r.ended, "Not ended");
        require(!r.bearsDistributed, "Already distributed");
        r.bearsDistributed = true;
        emit BearsDistributed(assetID, roundID);
    }

    /**
    * @notice Withdraws a specified amount of an ERC20 token to the DAO treasury. For tokens accidentally sent or stuck.
    * @param token The address of the ERC20 token to withdraw.
    * @param amount The amount of tokens to withdraw.
    */
    function withdrawTokens(address token, uint256 amount) external onlyMaintainer nonReentrant {
        require(token != address(usdc), "Cannot withdraw USDC using this function");
        IERC20(token).safeTransfer(daoTreasury, amount);
        emit TokensWithdrawn(token, amount);
    }


    function sellTeddyBear(uint256 teddyId) external nonReentrant {
        require(_teddyOwner[teddyId] == _msgSender(), "Not owner");

        // Burn Teddy Bear
        _teddyOwner[teddyId] = address(0);
        _teddyBalance[_msgSender()] -= 1;

        // Calculate payout
        // Base price: 10 USDC
        // Fee: teddyBearFeeBps
        uint256 fee = (TEDDY_BEAR_BASE_PRICE * teddyBearFeeBps) / 10000;
        uint256 payout = TEDDY_BEAR_BASE_PRICE - fee;

        // Transfer fee to DAO, payout to user
        if (fee > 0) {
            usdc.safeTransfer(daoTreasury, fee);
        }
        usdc.safeTransfer(_msgSender(), payout);

        emit TeddyBearSold(_msgSender(), teddyId, payout);
    }

    // -----------------------
    // Views and Helpers
    // -----------------------

    function getPriceFromOracle(address oracle, address asset) internal view returns (uint256) {
        // Expecting oracle to return price in USDC (6 decimals)
        require(oracle != address(0), "No oracle");
        return IPriceOracle(oracle).getPrice(asset);
    }

    function currentTicketPrice(uint256 assetID, uint256 roundID) external view returns (uint256) {
        Round memory r = rounds[assetID][roundID];
        require(r.startTime > 0, "No round");

        uint256 elapsed = block.timestamp > r.startTime ? (block.timestamp - r.startTime) : 0;
        AssetConfig memory config = assets[assetID];
        uint256 cutoffTime = (config.interval * CUTOFF_PERCENT_BPS) / 10000;
        if (elapsed > cutoffTime) {
            elapsed = cutoffTime;
        }

        uint256 variablePart = (5 * USDC_DECIMALS * elapsed) / cutoffTime;
        uint256 price = BASE_TICKET_PRICE + variablePart;
        return price;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        // ERC165 Interface
        // ERC721 Interface ID: 0x80ac58cd
        return interfaceId == type(IERC721).interfaceId || super.supportsInterface(interfaceId);
    }

    // ERC721-like functions for Teddy Bears
    function balanceOf(address owner) public view returns (uint256) {
        return _teddyBalance[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _teddyOwner[tokenId];
        require(o != address(0), "Nonexistent teddy");
        return o;
    }

    function _mintTeddy(address to) internal {
        _nextTeddyId++;
        _teddyOwner[_nextTeddyId] = to;
        _teddyBalance[to] += 1;
        emit TeddyBearMinted(to, _nextTeddyId);
    }

    // Dummy functions for ERC721 compatibility - no external transfers except selling back
    function safeTransferFrom(address, address, uint256) external pure {
        revert("External transfer not allowed");
    }

    function transferFrom(address, address, uint256) external pure {
        revert("External transfer not allowed");
    }

    function approve(address, uint256) external pure {
        revert("No approvals");
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function setApprovalForAll(address, bool) external pure {
        revert("No setApprovalForAll");
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function name() external pure returns (string memory) {
        return "Teddy Bear NFT";
    }

    function symbol() external pure returns (string memory) {
        return "TEDDY";
    }

    function tokenURI(uint256 tokenId) external pure returns (string memory) {
        // Placeholder URI
        return string(abi.encodePacked("https://example.com/teddy/", Strings.toString(tokenId)));
    }
}
