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
