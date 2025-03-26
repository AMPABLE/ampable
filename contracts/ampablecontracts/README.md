# Ampable





This README includes:

- **Deployment Guide:** How to deploy the proxy and underlying contract, connect them, and verify setup.
- **Established Tokens & Dropdowns:** Explanation of how they are fetched and stored in the smart contract.
- **Uniswap v4 Integration:** How the price retrieval works for assets, including how pool lookups work on-chain.
- **Thresholds & Time Intervals:** Explanation of why we are setting 10-year intervals and how constant view functions provide countdowns.
- **DAO Functionality:** Overview of the DAO's control over listings, updates, fees, and Uniswap endpoints.
- **Frontend Integration:** How the UI interacts with smart contract functions, including views and transactions.
- **Security Considerations:** Addressing potential vulnerabilities and mitigation strategies.


#DAO Contracts Addresses (Arbitrum)

Ampable DAO [https://admin.daohaus.club/#/molochv3/0xa4b1/0x40054f7272b87dd7eaadb12cf14a02972b3849a](https://admin.daohaus.club/#/molochv3/0xa4b1/0x40054f7272b87dd7eaadb12cf14a02972b3849ae)

`0x40054f7272b87dd7eaadb12cf14a02972b3849ae`

Gnosis Safe (Treasury)

`0x20c28fc483bd1b4e3187aa13f792fb64dcbd93fe`

Voting Token

`0x5e0f7947bb6186de2fd1cde5a8fe63656401d5b1`

Non-Voting Token

`0x9e445dbb8f4a298187006add36a7ad6a79d2330d`


# Smart Contract Deployment and Integration Guide

This README provides developers with a comprehensive step-by-step guide to deploy the smart contracts (including an upgradeable proxy and logic contract), configure DAO ownership, and integrate the contracts with the frontend demo. It also covers details of token management, Uniswap v4 price integration, timing logic for prediction rounds, DAO admin functions, frontend interaction examples, security considerations, and testing/troubleshooting tips. Each section below corresponds to the outlined topics.

## 1. Deployment Guide

**Overview:** The smart contract system uses a proxy pattern to allow upgradability. You will deploy the **implementation contract** (the underlying logic) and a **proxy contract** that delegates calls to the implementation. After linking the proxy to the implementation, you’ll set the DAO as the owner/admin to control upgrades and critical settings. This section guides you through deployment, connection, verification, and ownership transfer.

### Deploying the Proxy and Underlying Contract

1. **Compile and Prepare Contracts:** Ensure the implementation (logic) contract (e.g. `YourContract.sol`) is compiled. If using Hardhat or Truffle with OpenZeppelin Upgrades, you can leverage their plugins to deploy upgradeable contracts.

2. **Deploy the Implementation Contract:** Deploy the logic contract to Optimism. For example, using Hardhat: `const Logic = await ethers.getContractFactory("YourContract"); const logicInstance = await Logic.deploy();`. Note the deployed address of the implementation.

3. **Deploy the Proxy Contract:** Deploy a proxy that points to the implementation. If using OpenZeppelin’s Transparent proxy pattern, deploy `TransparentUpgradeableProxy` with constructor args: (implementation address, proxy admin address, initialization call). Alternatively, use Hardhat Upgrades: `const proxy = await upgrades.deployProxy(Logic, [constructorArgs], { kind: 'transparent' });` which handles deploying a ProxyAdmin and proxy for you. This results in a proxy contract address that users will interact with.

4. **Initialize the Proxy:** If not using the plugin’s deployProxy (which calls initializer automatically), call the initialization function through the proxy. For example, if your logic contract has `initialize(address dao, ...)` as initializer, do: `await logicInstance.connect(proxySigner).initialize(initialDaoAddress, ...)`. Using a proxy ensures `constructor` code in the logic is not run—initialization is done via a function call.

5. **Verify Deployment:** At this stage, the proxy’s address should be connected to the implementation. You can verify by calling a simple view function through the proxy (using ethers or web3) and confirming it returns expected default values. Also consider verifying the contracts on Etherscan (both the implementation and proxy) for transparency. On Etherscan Optimistic Ethereum, mark the proxy as a proxy so its implementation can be decoded.

### Connecting and Verifying the Setup

After deployment, ensure the proxy correctly delegates to the implementation:

- **Proxy -> Implementation Wiring:** The proxy should have the implementation’s address stored in its storage (for Transparent proxies, in the EIP-1967 slot). If using OpenZeppelin’s plugin, it handles this. If manual, double-check that the proxy’s `implementation()` (if using EIP1967Proxy with an interface) returns the correct logic address.

- **Function Calls:** Test a few function calls via the proxy. For example, if there’s a `getRoundInterval()` view in the logic, do `await proxyContract.getRoundInterval()` and confirm it matches the logic’s internal default. A successful response means the proxy is wired up.

- **Events:** If initialization emitted events (like an `OwnershipTransferred` event setting DAO as owner), check the transaction logs to verify the DAO is indeed set.

- **Upgrade Readiness:** Although you haven’t performed an upgrade yet, it’s good to ensure the proxy admin is set correctly (the account that can upgrade). We will transfer this to the DAO in the next step.

### Setting Up DAO Ownership and Administrative Control

For security and decentralization, the DAO (e.g. a multi-sig or governance contract) should own the proxy (or the ProxyAdmin) and have exclusive rights to admin functions in the logic:

- **Transfer Proxy Admin Ownership to DAO:** If using a Transparent proxy, there is a ProxyAdmin contract that initially is owned by your deployer account. Transfer this to the DAO multi-sig address. For example, using OpenZeppelin’s ProxyAdmin: `await proxyAdmin.transferOwnership(DAO_ADDRESS)`. After this, the DAO controls upgrades ([Using a Gnosis Safe to Upgrade Upgradable Contracts | Developer Jesse](https://developerjesse.com/2025/01/10/upgradable-contract-with-gnosis.html#:~:text=Transfer%20Ownership%20of%20the%20ProxyAdmin,Contract)). *(In a Hardhat Upgrades setup, you can use `await upgrades.admin.transferProxyAdminOwnership(DAO_ADDRESS)` to achieve this.)*

- **Verify DAO Control:** After transferring, any upgrade or admin call should only be possible via the DAO. You can confirm by calling `proxyAdmin.owner()` to see it returns the DAO address ([Using a Gnosis Safe to Upgrade Upgradable Contracts | Developer Jesse](https://developerjesse.com/2025/01/10/upgradable-contract-with-gnosis.html#:~:text=Transfer%20Ownership%20of%20the%20ProxyAdmin,Contract)). Also, try calling an admin-only function from a non-DAO account to ensure it is correctly restricted (it should revert).

- **Set DAO as Contract Owner (if applicable):** If the logic contract uses an `Ownable` pattern for internal admin (separate from the proxy admin), transfer that ownership to the DAO as well. For example: `await proxyContract.transferOwnership(DAO_ADDRESS)` if the contract inherits OpenZeppelin Ownable. This ensures the DAO can call administrative functions defined in the logic (like adding tokens, updating fees, etc., discussed later).

- **Document Addresses:** Record the deployed proxy address and ensure the DAO has the ability to execute transactions on Optimism. Typically, the DAO multi-sig will need to be configured to operate on Optimism’s network RPC and have some ETH for gas.

By the end of this step, the upgradeable contract is deployed, the proxy is connected to the implementation, and the DAO is the owner/admin. The system is now ready for adding token data and interacting with the frontend.

## 2. Established Tokens & Dropdowns

**Overview:** The contract comes preloaded with a list of established tokens (like USDC, WETH, WBTC, etc.) that are supported for prediction markets. These tokens are stored on-chain (usually as an array or mapping in the contract). The frontend uses this list to populate dropdown menus for users to select tokens. This section explains how the contract stores these tokens, how new tokens can be added dynamically (by users or the DAO), and how the dropdown options are generated.

### Preloaded Token List (Established Tokens)

- **Initial Token Set:** Upon deployment (or via an initialization function), the contract is configured with a set of well-known tokens. For example, it might include stablecoins and major assets like USDC, WETH, WBTC, LINK, etc. These could be coded in the constructor or added in an `initialize` call by the deployer/DAO.

- **Storage Structure:** The contract likely maintains a list or mapping for supported tokens. A common approach is an array `supportedTokens[]` storing token addresses, and a mapping `isSupported[tokenAddress] = true`. Additional metadata (like a display name or active flag) might be stored in a struct or separate mappings. For instance, `tokenInfo[tokenAddress] = Token({name: "USDC", active: true, ...})`. The **dropdown** uses this data.

- **Token Identification:** The dropdown options (token names or symbols) can come either from on-chain data or off-chain mapping. Often, the contract may not store the full name to save gas (since the ERC-20 itself can provide name/symbol via `name()`/`symbol()` calls). A straightforward approach is for the frontend to call each token’s ERC-20 `symbol()` to display in the UI, given the addresses from `supportedTokens`. Alternatively, the contract might have stored symbol strings or a bytes32 identifier for each token.

- **Example:** If USDC and WETH are preloaded, `supportedTokens[0] = 0x...USDC` and `supportedTokens[1] = 0x...WETH`. The UI will retrieve this array and for each address call the token contract’s symbol to display (e.g., "USDC", "WETH"). The contract can also provide a helper view, such as `getSupportedTokens()` returning the full list, or `getTokenInfo(address)` returning metadata.

### Dynamic Addition of User-Requested Tokens

- **User-Generated Tokens:** The system allows new tokens to be added for prediction rounds, either by user action or via the DAO. For security, this is likely gated by the DAO or certain criteria (to avoid spam or unsupported assets). In some designs, any user can **suggest** a token, but the contract will validate it (e.g. check Uniswap liquidity, etc.) and mark it supported if it meets requirements.

- **DAO or Automatic Listing:** The DAO can directly call an admin function like `addToken(address token, string name, ...)` to list a new token. This function would add the token to `supportedTokens` and initialize any associated metadata (like fee tier for Uniswap or decimals normalization). In a more automated approach, the contract might let users call something like `requestTokenListing(address token)` which triggers a check (ensuring the token has an existing Uniswap pool with the reference asset, and sufficient liquidity). If the check passes, the token could be added to the list and become available in the dropdown.

- **Dynamic Dropdown Updates:** Once a token is added on-chain, it will appear in the results of `getSupportedTokens()`. The frontend should fetch this list on page load or when the user is searching in the dropdown. Newly added tokens (either by DAO or via automatic mechanism) thus become immediately selectable by users without a code deploy. The UI might also filter out any tokens marked as inactive or delisted (see DAO functionality below for delisting).

- **Storage of New Tokens:** For each new token, the contract might store some details. For instance, it may store the token’s address and perhaps cache the token’s decimals or symbol to avoid repeated external calls. Some contracts emit an event like `TokenAdded(address token, string symbol)` on addition — the frontend can listen to this event to update its local state as well.

### Source of Dropdown Information

- **On-Chain Source:** The primary source of truth for dropdown options is the smart contract’s supported token list. For example, the contract could have a public view `getTokens()` returning an array of addresses for all tokens that are supported and not delisted. The UI calls this once and then for each address either knows the name (if hardcoded for known ones) or calls the token contract’s `symbol()` method via web3.

- **Contract View Functions:** The contract may provide convenience views such as `getTokenCount()` and `getTokenByIndex(uint index)` or return a tuple of (address, name, active) for each token. The **dropdown** can be populated by iterating through these. Because Solidity cannot easily return an array of strings, some designs simply return addresses and rely on the frontend to map to names.

- **Preloaded Token Data:** In our Optimism deployment, well-known token addresses (for example: **USDC**, **WBTC**, **WETH**, **LINK**, **WLD**) are already stored after deployment. These correspond to actual Optimism token contracts: e.g., USDC at `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` (the native Circle-issued USDC on Optimism ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=,opens%20in%20a%20new%20tab))), WBTC at `0x68f180fcCe6836688e9084f035309E29Bf0A2095` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Wrapped%20BTC%20WBTC0x2260fac5e5542a773aa44fbcfedf7c193bc2c599%20,opens%20in%20a)), WETH at Optimism’s canonical WETH `0x4200000000000000000000000000000000000006` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Wrapped%20BTC%20WBTC0x2260fac5e5542a773aa44fbcfedf7c193bc2c599%20,opens%20in%20a)), Chainlink (LINK) at `0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Chainlink%20LINK0x514910771af9ca656af840dff83e8264ecf986ca%20,opens%20in%20a%20new%20tab)), and Worldcoin (WLD) at `0xdC6fF44d5d932Cbd77B52E5612Ba0529DC6226F1` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Worldcoin%20WLD0x163f8C2467924be0ae7B5347228CABF260318753%20,opens%20in%20a%20new%20tab)). These addresses are stored in the contract so the UI can present them in dropdowns from day one.

- **Preventing Duplicates:** The contract likely guards against adding a token twice (using the `isSupported` mapping). If a user/DAO tries to add an already listed token, the function would revert or ignore to keep the list unique.

By managing the token list on-chain, we ensure that the frontend is always in sync with the contract’s capabilities, and new listings or delistings by the DAO are reflected immediately to all users.

## 3. Uniswap v4 Integration

**Overview:** The contract integrates with Uniswap (v4) to fetch real-time token prices and liquidity data. This is crucial for determining the outcomes of prediction rounds (e.g., closing prices) and for ensuring the token has enough liquidity to be safely listed. This section explains how the contract queries Uniswap pools for price information, how it identifies the correct pool for a token, how liquidity is checked, and why a trade size of 10,000 USDC is used as a basis for price evaluation.

### Fetching Token Prices from Uniswap

- **Uniswap v4 Singleton Design:** Uniswap v4 uses a single **PoolManager** (singleton) contract to manage all pools, rather than individual pool contracts per pair as in v3 ([Reading Pool State | Uniswap](https://docs.uniswap.org/contracts/v4/guides/read-pool-state#:~:text=The%20Singleton%20Design)) ([Uniswap V4: Everything You Need To Know. | blocmates](https://www.blocmates.com/articles/uniswap-v4-everything-you-need-to-know#:~:text=Flash%20accounting%3A%20This%20sweet%20addition,Combine%20it%20with)). This means our contract interacts with the unified v4 contract to get price info. We likely use Uniswap’s provided interfaces or libraries to read pool state. For example, given two token addresses and a fee tier, we derive a **pool identifier** and query the PoolManager for the current price or perform a read-only swap simulation.

- **Identifying the Correct Pool:** For each supported token, the contract needs to find its Uniswap pool against a reference token (usually USDC or WETH). Typically, USDC is used as the quote asset for price (since we want price in USD). In Uniswap v3, one would call the factory’s `getPool(token, USDC, fee)` to get the pool address ([Deployment Addresses | Uniswap](https://docs.uniswap.org/contracts/v3/reference/deployments/#:~:text=You%20can%20look%20up%20the,contract)). In Uniswap v4, instead, one would use the `poolId` mechanism. The v4 PositionManager can retrieve pool details by `poolKeys(poolId)` given a poolId (which is derived from the two token addresses, fee, and any hooks) ([How can I fetch pool data in Uniswap v4? - Ethereum Stack Exchange](https://ethereum.stackexchange.com/questions/167949/how-can-i-fetch-pool-data-in-uniswap-v4#:~:text=In%20Uniswap%20v4%20you%20have,hooks)). Our contract might maintain a mapping of token -> poolId or compute it on the fly. In most cases, we standardize on a single fee tier (e.g., 0.3% fee tier, which is `3000` in Uniswap terms) for price feeds to simplify. That means each token’s price is fetched from the Uniswap v4 pool with USDC at the 0.3% fee tier (if available).

- **Price Query Mechanism:** Uniswap v4 does *not* include built-in TWAP oracles by default ([Oracle | Uniswap](https://docs.uniswap.org/concepts/protocol/oracle#:~:text=)), so our contract likely performs a direct query of the current pool state or uses a short time-weighted average. A common approach is to use Uniswap’s **Quoter** library/contract to simulate a swap of a fixed amount of USDC for the target token (without executing it) to get a quote. In v3, the `Quoter` contract (address `0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6` on Optimism ([Optimism Deployments | Uniswap](https://docs.uniswap.org/contracts/v3/reference/deployments/optimism-deployments#:~:text=,0xd7c6e867591608D32Fe476d0DbDc95d0cf584c8F))) has a function `quoteExactInputSingle(tokenIn, tokenOut, fee, amountIn, sqrtPriceLimitX96)` that returns how many tokenOut you’d get for a given amountIn. Our contract can call this from a view function (using `staticcall`) to get the current price. In v4, similar functionality might be achieved via the new `StateView` or by performing a read operation on the PoolManager’s storage (though an official QuoterV2 is listed for v3 ([Optimism Deployments | Uniswap](https://docs.uniswap.org/contracts/v3/reference/deployments/optimism-deployments#:~:text=)) ([Optimism Deployments | Uniswap](https://docs.uniswap.org/contracts/v3/reference/deployments/optimism-deployments#:~:text=Quoter,0xd7c6e867591608D32Fe476d0DbDc95d0cf584c8F)), Uniswap v4 may require using hooks or an off-chain computation for complex quotes).

- **On-Chain Price Calculation:** If using the pool state directly, our contract could read the pool’s **slot0** data (which contains the current price as a sqrt ratio and current tick). From the sqrtPriceX96 value, it can compute the price ratio of the two assets. For instance, for a USDC/token pool, the price of the token in USDC can be derived from that ratio. However, because of potential precision and liquidity issues, the contract instead might opt for the Quoter method mentioned for accuracy.

- **Example:** To get the price of WETH in USDC, we query the WETH/USDC pool. If 1 WETH = 1800 USDC currently, a quote for 10,000 USDC input should return around 5.555 WETH. The contract would interpret this as a price of ~1800 USDC per WETH (10000/5.555). By using a fixed USDC input, we effectively sample the price.

### Looking Up Pools and Retrieving Liquidity

- **Pool Lookup:** As mentioned, for each token we likely assume a pairing with USDC (or WETH if USDC pool doesn’t exist). The contract may have stored the pair information upon token addition (e.g., which quote asset to use and what fee). When fetching the price, it uses that info to locate the pool. In Uniswap v3, the `UniswapV3Factory` at address `0x1F98431c8aD98523631AE4a59f267346ea31F984` on Optimism can be called with `getPool(token, usdc, 3000)` ([Deployment Addresses | Uniswap](https://docs.uniswap.org/contracts/v3/reference/deployments/#:~:text=You%20can%20look%20up%20the,contract)) to get the pool address, then interface with `IUniswapV3Pool` for data. In v4, all pools are in the singleton, so instead the contract might compute the poolId and query the PoolManager/PositionManager as described. The poolId could be `keccak256(token0, token1, fee, hooks)` truncated to 25 bytes as per v4 spec.

- **Liquidity Check:** Before listing a token or finalizing a round, the contract likely checks that the Uniswap pool has sufficient liquidity. A very low-liquidity pool could be easily manipulated (see Security Considerations). One measure of liquidity is the pool’s reserves or the value of 10,000 USDC trade impact. For example, if swapping 10,000 USDC moves the price by only a tiny fraction, the pool is deep. If it moves the price by a large amount or fails, the pool is too shallow. The contract could retrieve the *liquidity* parameter from the pool (Uniswap v3 pools have a `liquidity` value indicating total liquidity in range). In Uniswap v4, because of hooks and possibly multiple positions, it might also use similar parameters. Our contract might require that the pool’s liquidity exceeds some threshold before allowing bets.

- **Using 10,000 USDC for Price Evaluation:** We use a fixed notional value (10,000 USDC) as the basis for price queries to standardize price calculations across tokens. This has a few advantages:
  - It provides a **normalized price**: quoting the output for 10k USDC yields a price that is easier to compare across tokens (and not as sensitive to minor pool imbalances).
  - It ensures **liquidity sufficiency**: if a pool cannot even handle a 10k swap without significant slippage, it’s likely too illiquid. By using this amount, the contract inherently filters out tokens with extremely low liquidity (the price quote might be unreliable or the swap might revert for insufficient liquidity).
  - It helps mitigate manipulation by requiring an attacker to have at least 10k USDC (and likely much more to move the price significantly) to influence the price reading, raising the cost of an attack.

- **Price Calculation Detail:** Suppose token X/USDC pool returns `Y` units of token X for 10,000 USDC. The contract can calculate price as `10000 / Y`. If Y is given in token’s smallest units, careful scaling by decimals is needed. Alternatively, if quoting token->USDC, we could quote 1 token X to see how much USDC it yields (but using 1 token might not trigger enough precision, so we use a large chunk of USDC instead).

- **Caching Prices:** The contract might fetch prices on-demand (e.g., at round end) and possibly store the last price for reference. However, since prices are fetched from Uniswap directly, there may not be a need to store them except for determination of winners. The integration ensures that when a prediction round ends, the contract can get the final price from Uniswap and use it to resolve bets.

- **Why Uniswap (and not Chainlink)?:** Uniswap’s on-chain data provides a decentralized price source without relying on an external oracle, which fits the on-chain ethos. However, Uniswap prices can be manipulated short-term. The design choices (like using 10k USDC and requiring deep liquidity) are meant to mitigate those risks, making Uniswap a viable price oracle in this context. (In a later section we discuss security and manipulation in more detail.)

### Uniswap v4 Considerations

- **Hooks and Customizations:** Uniswap v4 introduces hooks (custom code that can run on swaps or other events). Our integration primarily uses Uniswap as a price source; we likely do **not** provide any custom hooks ourselves (those are for pool creators). We do need to be aware if a pool has a hook that could affect price reporting (e.g., a **truncated oracle hook** might limit price movement per block ([Uniswap v4 Truncated Oracle Hook](https://blog.uniswap.org/uniswap-v4-truncated-oracle-hook#:~:text=Previously%20we%20wrote%20about%20the,techniques%20and%20safer%20for%20DeFi)) ([Uniswap v4 Truncated Oracle Hook](https://blog.uniswap.org/uniswap-v4-truncated-oracle-hook#:~:text=A%20truncated%20price%20oracle%20uses,are%20less%20subject%20to%20manipulation))). For simplicity, we assume standard pools without exotic hooks for now, or that such hooks only make the price more manipulation-resistant (which is beneficial).

- **Singleton Contract Address:** Developers may need the actual deployed addresses for Uniswap v4 on Optimism. (At the time of writing, Uniswap v4 is proposed but not fully deployed on mainnets yet – if not available, the system might still be using Uniswap v3 on Optimism for price data). Ensure to update the contract addresses once Uniswap v4 is live on Optimism. The **Uniswap v4 PoolManager** and **PositionManager** addresses should be set in the contract or easily updatable by the DAO (in case of upgrades or network changes).

- **Reference Contracts:** For further reading, Uniswap’s documentation and code can be referenced. The `PoolManager` holds pools (see Uniswap v4 docs on reading pool state ([Reading Pool State | Uniswap](https://docs.uniswap.org/contracts/v4/guides/read-pool-state#:~:text=The%20Singleton%20Design))) and the `PositionManager` is used to get pool keys ([How can I fetch pool data in Uniswap v4? - Ethereum Stack Exchange](https://ethereum.stackexchange.com/questions/167949/how-can-i-fetch-pool-data-in-uniswap-v4#:~:text=In%20Uniswap%20v4%20you%20have,hooks)). Uniswap v3’s approach to price oracles (observations and TWAP) is documented in their official docs ([Oracle | Uniswap](https://docs.uniswap.org/concepts/protocol/oracle#:~:text=)) and provides context on how v4 differs (v4 relies on external hooks for oracle functionality).

In summary, the contract actively queries Uniswap for prices, ensuring that each token’s price feed is up-to-date and based on actual on-chain market conditions. By using a consistent USDC quote amount and checking liquidity, the integration strikes a balance between decentralization and reliability of price data.

## 4. Thresholds & Time Intervals

**Overview:** Prediction rounds operate on fixed time intervals (e.g., daily rounds, weekly rounds) that begin and end at predetermined times. The smart contract uses these time thresholds to decide when a round has expired and a new round begins. This section describes how the contract determines round expiration, why fixed schedules (like daily at midnight UTC or weekly on Sundays) are used, and what view functions exist to help the frontend and users know the remaining time in the current round.

### Fixed Round Schedules (Daily/Weekly Rounds)

- **Round Duration:** Each round has a constant duration defined (for example, 24 hours for daily rounds, 7 days for weekly rounds, etc.). The contract likely has this stored as a constant or variable (e.g., `roundInterval = 1 days` for daily). For weekly, it could be `7 days` or a specific epoch schedule.

- **Start and End Times:** The contract may define rounds aligned to real-world clock boundaries. For daily rounds, it might use midnight UTC as the cutoff. This could be implemented by truncating block timestamps to a 24h window. For example, `roundId = block.timestamp / 86400` (integer division) could serve as the current day index. Similarly, for weekly, perhaps `roundId = block.timestamp / (7 * 86400)`. If more specific (like “weekly on Sundays”), the contract might offset the timestamp to align the 0 point to a Sunday. A known approach is to find the next occurrence of the target boundary: e.g., find the timestamp of the upcoming Sunday midnight and then use 7-day cycles.

- **Implementation:** The contract might not store each round’s start and end explicitly for all tokens. Instead, it can compute on the fly whether the current time is in round N or N+1. For instance, if daily, and we want rounds to reset at 00:00 UTC, we could do: `currentRoundEnd = (block.timestamp / 86400 + 1) * 86400` (which gives tomorrow’s midnight as Unix time). If `block.timestamp` has passed that, then we’re in the next round.

- **Expiration Check:** When a user tries to make a prediction or when the contract attempts to settle a round, it will check the current timestamp against the round’s end. If the time is past the threshold, that round is over. The contract might then freeze further bets for that round and record the outcome (price at the exact end time, which might be fetched slightly after the threshold due to transaction time, but effectively the closing price).

- **Cron-like Behavior:** By using a time formula, no one needs to “trigger” the new round at midnight; the contract logic treats any action after the threshold as pertaining to the new round. This removes reliance on external cron jobs and ensures fairness (no one can delay or hasten the round end manually).

- **Example:** For daily rounds: if a round’s end is at 00:00:00 UTC, any bet or action at 23:59 UTC is still round N, and any action at 00:00:10 UTC is round N+1 (with round N having just ended). The contract can determine that by comparing timestamps.

### Why Fixed Schedules?

- **Fairness:** Fixed schedules prevent any party from choosing a favorable end moment. If round end were flexible or triggered by an admin, it could be manipulated (ending the round at a spike or dip in price). A fixed daily/weekly schedule means the price snapshot is taken at a predetermined time, known to everyone in advance, ensuring a level playing field.

- **Simplicity for Users:** Users know exactly when rounds start and end (e.g., “Rounds end at midnight UTC every day”). This transparency helps them participate confidently. Weekly rounds ending on Sunday midnight give a familiar cycle (perhaps aligning with market weeks).

- **Contract Simplicity:** Using the blockchain timestamp to enforce timing means we don’t need complex state to track round numbers—simple arithmetic can derive the current round. It also means even if no one calls a function exactly at the round boundary, the first interaction after the boundary will correctly handle the transition.

- **Consistency:** If the rounds are aligned to UTC boundaries, external data (like price feeds or market data) can be easily correlated. For example, one can verify the closing price at midnight by independent means if needed.

### Round Expiration and Countdown

- **Round Expiry Determination:** In code, you might see something like:
  ```solidity
  uint256 interval = 86400; // 1 day
  uint256 currentRoundId = block.timestamp / interval;
  ```
  The contract could use `currentRoundId` as an identifier. If a stored `lastRoundId` for a token is less than `currentRoundId`, it knows a new round has started and it needs to settle the previous round outcomes.

- **Automatic Settlement:** Possibly, the contract might auto-settle on the first action of a new round. For example, when a user places a bet in a new round, the contract checks and if the previous round wasn’t settled, it fetches the closing price from Uniswap (using the price fetch mechanism above, at the interval boundary) and finalizes payouts for that previous round before accepting the new bet.

- **View Functions for Countdown:** The contract likely offers view functions to help the frontend display time remaining:
  - `getTimeUntilNextRound()` or `getRoundEndTime()` – returns the seconds until the current round ends, or the exact timestamp of the next boundary.
  - `getCurrentRound()` – returns an identifier or index of the current round (for each token’s market).
  - Possibly `isRoundActive(roundId, token)` – to query if a given round is still active (not ended).

- **Countdown Example:** A function might do:
  ```solidity
  function getRoundCountdown() public view returns (uint256 secondsRemaining) {
      uint256 nowTs = block.timestamp;
      uint256 nextMidnight = (nowTs / 86400 + 1) * 86400;
      return nextMidnight - nowTs;
  }
  ```
  This would give the number of seconds until midnight (round end). The frontend can call this and display it to users.

- **Multiple Interval Support:** If the contract supports both daily and weekly markets (perhaps separate pools or separate token configurations), it might have different intervals per market. For instance, a struct for each token might include `intervalType` (daily or weekly). The view function could then calculate accordingly: if weekly, use 604800 seconds interval, aligned to a reference Sunday.

- **Edge Cases:** The contract should handle edge cases like Daylight Savings (not applicable to UTC, so no issue) or leap seconds (solidity uses Unix time which will include any adjustments in block timestamps, but that’s negligible). Also, if no transactions occur for a while, rounds still conceptually pass – the next transaction will handle catching up any missed round settlements.

In summary, the contract enforces a strict timeline for rounds to avoid any arbitrary control of timing. It uses simple timestamp arithmetic to delineate rounds and provides convenient views so the frontend and users can always know how much time is left. This predictable schedule is crucial for fairness and easier integration.

## 5. DAO Functionality

**Overview:** The DAO (decentralized autonomous organization) that governs the platform has special administrative powers in the smart contract. These include updating external contract addresses (like Uniswap endpoints if needed), adjusting fees or parameters, managing the token list (adding new tokens or delisting existing ones), and tweaking metadata for tokens. This section details what the DAO can do, how delisting of a token works (and how it affects the UI and contract behavior), and what administrative controls are in place for token listings and other settings.

### Administrative Controls and Updatable Parameters

Once the DAO is set as the owner/admin (from Section 1), it can call various admin-only functions in the contract. Examples of such functions:

- **Update Uniswap Integration Points:** The DAO can update addresses like the Uniswap **Factory/PoolManager address**, **Router/Quoter address**, or any other external contract addresses the system uses. This is important if Uniswap upgrades (for example, moving from v3 to v4 on Optimism, the DAO could update the contract to use the new PoolManager singleton). The contract likely stores these as variables (`uniswapFactory`, `uniswapPositionManager`, `quoter`, etc.) that only the owner can change. This ensures if Uniswap’s deployment changes or if we switch to a different DEX (in an emergency), the platform can adapt without a full redeploy.

- **Fee Configuration:** If the game logic involves fees (e.g., a percentage of the pot that goes to the treasury, or different fee tiers for different tokens on Uniswap), the DAO can adjust those. For instance, there might be a `platformFee` that the contract takes from winnings. The DAO could call `setPlatformFee(uint newFee)` (onlyOwner) to change this. Additionally, for Uniswap price queries, if we want to use a different fee tier pool (say some token might have only a 1% fee pool liquid, instead of 0.3%), the DAO could set the fee for that token’s price lookup. Perhaps the contract stores something like `tokenSettings[tokenAddress].uniswapFeeTier` which the DAO can modify for optimal price accuracy.

- **Token Metadata Updates:** The DAO may update token-specific metadata stored in the contract. For example, if a token’s symbol or name changes (rare, but possible with rebranding), or if we want to attach a category or risk level to a token, the DAO could update those fields. If the contract keeps a whitelist of acceptable tokens, it might also store something like a min liquidity threshold per token which the DAO can tweak (e.g., require higher liquidity for volatile tokens). The DAO could call `updateTokenInfo(address token, string name, bool active, uint minLiquidity)` to change stored info.

- **Pause/Unpause Features:** Many contracts have a `pause` functionality (via OpenZeppelin’s Pausable) that the owner/DAO can trigger in case of an emergency. The DAO could pause betting or the whole contract if an issue is detected, preventing new actions until resolved.

### Token Delisting

Delisting refers to removing or disabling a token from the platform (perhaps due to low liquidity, security issues, or at the community’s behest):

- **How Delist is Implemented:** The contract might not fully remove the token from the `supportedTokens` array (as that would require shifting array elements, which is doable but potentially gas-heavy). Instead, it can mark the token as **inactive** or **delisted**. For example, `tokenInfo[token].active = false`. Any functions that allow new bets on tokens would check this flag and reject if false. This way, existing data for the token is preserved (for historical rounds or pending settlements) but no new rounds/bets can start for it.

- **Effect on Searchability/UI:** Once a token is marked delisted, the frontend should ideally hide it from the dropdown or mark it as inactive. If the UI calls a function like `getSupportedTokens()`, the contract might either:
  - Filter out inactive tokens (return only active ones), or
  - Return all and also provide the `active` status so the UI can filter.
In either case, the token would no longer appear as a choice for users, thus effectively removing it from circulation.

- **Ongoing Rounds:** If a token is delisted mid-round, the contract should handle this gracefully. Likely, it would allow the current round to finish and winners to claim, but prevent any new round from starting. The DAO might choose to immediately settle and refund all bets if a token is delisted for a severe reason. The rules around this should be communicated to users (e.g., “If a token is delisted, ongoing rounds are canceled and funds returned”).

- **Delisting Process:** The DAO would call something like `delistToken(address token)` (onlyOwner) which sets that token’s status to inactive. It could also emit an event `TokenDelisted(token)` for transparency. The contract might also maintain a separate list of delisted tokens or simply rely on the flag.

- **Relisting:** If a token was delisted due to temporary issues (like low liquidity that later improves), the DAO can relist by calling an `activateToken(address token)` or the same add function if it was fully removed. If the entry was kept and just flagged, flipping `active` to true would make it available again.

### DAO-Updatable Odds and Round Parameters

Beyond tokens, the DAO might influence how rounds work:

- **Adjust Round Intervals:** The DAO could, for example, decide to introduce a new round type or adjust timing. If the contract was built to allow it, the DAO could change the duration of rounds (e.g., from daily to hourly, though if rounds are aligned to midnight this is likely fixed). More realistically, the DAO might enable new game modes (like hourly rounds, monthly rounds) by configuring new interval values in the contract, if supported.

- **Update House Odds or Payout Structure:** If the contract has any concept of odds beyond the pure pool distribution (for instance, a guaranteed payout ratio or a fee that affects odds), the DAO can tweak those. For example, a setting like `minPayoutMultiplier` or any incentive mechanism could be adjustable.

- **Edge Contract Addresses:** In some designs, the contract might rely on an external randomness source (if used for something) or an oracle. If so, the DAO could update those addresses as well. However, our system primarily relies on price data from Uniswap, so the main external addresses are Uniswap-related.

### Ensuring Secure Admin Actions

All these DAO functions are protected so only the DAO’s address (which could be a multi-sig or a governance contract) can call them. This was set up in Section 1 via transferOwnership. It’s critical that these functions are not accessible to regular users:

- The contract likely uses `onlyOwner` (OpenZeppelin’s modifier) on admin functions, or a custom check like `require(msg.sender == admin, "Not authorized");`.

- The DAO’s multi-sig should be a secure wallet (e.g., Gnosis Safe) with multiple signers to avoid a single point of failure. As noted, we transferred ProxyAdmin ownership to the Gnosis Safe earlier ([Using a Gnosis Safe to Upgrade Upgradable Contracts | Developer Jesse](https://developerjesse.com/2025/01/10/upgradable-contract-with-gnosis.html#:~:text=Transfer%20Ownership%20of%20the%20ProxyAdmin,Contract)).

- Any changes the DAO makes are transparent on-chain (events emitted, or can be observed via transaction logs). For example, if the DAO changes a Uniswap address, an event like `ParamUpdated(string param, address newValue)` might be emitted for record. The community should monitor such changes as part of decentralized governance.

### Example Admin Functions and Usage

Suppose the DAO wants to add a new token and later possibly remove one:
```solidity
// As the DAO (owner), add a new token with metadata
contract.addToken(
    NEW_TOKEN_ADDRESS,
    "ARB",        // symbol or name
    true,         // active
    3000          // fee tier for Uniswap pool
);

// Sometime later, if needed, mark it inactive:
contract.delistToken(NEW_TOKEN_ADDRESS);
```
In JavaScript (using ethers with the DAO’s signer):
```js
// Add a token (DAO multisig would initiate this transaction)
await contract.connect(daoSigner).addToken(tokenAddr, "ARB", true, 3000);
console.log("Token added:", tokenAddr);

// Delist a token
await contract.connect(daoSigner).delistToken(tokenAddr);
console.log("Token delisted:", tokenAddr);
```
After delisting, the `getSupportedTokens` view might either not return `tokenAddr` or mark it as inactive. The frontend would then exclude it from options.

Another example: updating Uniswap addresses (say Uniswap v4 goes live and we need to update the PoolManager):
```js
await contract.connect(daoSigner).updateUniswapPoolManager(newPoolManagerAddress);
console.log("Uniswap PoolManager updated");
```
This call would change the address the contract uses to fetch prices, thus seamlessly migrating to the new Uniswap without requiring every user to switch anything.

The DAO’s ability to manage these aspects ensures the platform can evolve (add new assets, respond to market changes) and handle emergencies (disable an asset or change an integration point) all through governance decisions, without changing the core contract code or requiring downtime.

## 6. Frontend Integration

**Overview:** The frontend dApp interacts with the deployed smart contract to display data (like token lists, countdowns, odds) and to let users execute transactions (placing bets, claiming rewards). This section explains how the UI retrieves contract data via web3/ethers calls, provides examples of calls for reading intervals and odds, and shows how to execute transactions (like joining a round) from the frontend. Understanding these interactions ensures a seamless integration between the contract and the demo code.

### Reading Contract Data (Web3/Ethers calls)

The frontend will use a library like **ethers.js** or **Web3.js** to call the contract’s public and view functions. Key data the UI needs:

- **Token List and Metadata:** The UI will call a function to get supported tokens (as discussed). For example:
  ```js
  const tokens = await contract.getSupportedTokens();
  ```
  This returns an array of token addresses (and possibly also symbols if the contract provides it). The UI can then for each address call the token’s `symbol()` via an ERC-20 ABI:
  ```js
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const symbol = await tokenContract.symbol();
  ```
  and populate the dropdown. Alternatively, if the contract has something like `getTokenInfo(address)`:
  ```js
  const [symbol, active] = await contract.getTokenInfo(tokenAddress);
  ```
  It can use that directly.

- **Round Time Remaining:** To display the countdown timer, the UI calls the view function for the countdown (e.g., `getRoundCountdown()` or similar):
  ```js
  const secondsLeft = await contract.getRoundCountdown();
  ```
  Then the UI converts `secondsLeft` to a human-readable HH:MM:SS. If the contract doesn’t have a direct countdown function but provides `getRoundEndTime()`, the UI can do:
  ```js
  const endTime = await contract.getRoundEndTime();
  const secondsLeft = endTime.toNumber() - Math.floor(Date.now()/1000);
  ```
  (taking care to use the correct time source and handle BigNumber).

- **Current Odds/Pools:** If the contract maintains the current pool sizes (total bet on “up” vs “down” for a token’s round), it likely has a view like `getRoundInfo(token)` returning amounts. For example:
  ```solidity
  function getRoundInfo(address token) view returns (uint256 bullAmount, uint256 bearAmount);
  ```
  The UI can call:
  ```js
  const [upPool, downPool] = await contract.getRoundInfo(tokenAddress);
  ```
  and then compute odds. Odds could be shown as ratio or percentage:
    - If upPool = 1000 USDC, downPool = 500 USDC, then an “up” bettor’s odds of winning (if correct) could be displayed as `500/1000 = 0.5x` (or 50% of pot; but usually we invert for payout multiplier: if you bet on down (smaller pool) you’d get a higher payout if you win).
    - The UI might show something like *Potential Payout*: “Win 2x if you bet Down” vs “Win 1.5x if you bet Up”, etc., based on pool sizes after fees.

  The contract might not directly provide the multiplier, but since it provides the pools, the UI can calculate:
  ```js
  const totalPool = upPool.add(downPool);
  const payoutMultiplierUp = totalPool.div(upPool);    // how many times your bet you get if up wins
  const payoutMultiplierDown = totalPool.div(downPool);
  ```
  (minus fee if any). It’s good to show these to users as odds.

- **Price and Last Round Outcome:** The UI may also display the last round’s closing price or whether it was up/down. The contract could have stored the last closing price or an outcome flag (e.g., “Bull won last round” if price went up). A view like `getLastRoundResult(token)` might return info. If not, the UI could derive it by comparing historical price points (if it has access to an external price history). However, likely the contract emits events for round outcomes that the UI can listen to or query.

- **Example of a view call (ethers.js):**
  ```js
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  // Fetch token list
  let tokenList = await contract.getSupportedTokens();
  tokenList = tokenList.map(addr => addr.toLowerCase());
  console.log("Supported tokens:", tokenList);

  // Fetch countdown for current round (assuming single global round timer)
  const secondsLeft = await contract.getRoundCountdown();
  console.log("Seconds until round ends:", secondsLeft.toString());

  // Fetch current bet pools for a token (e.g., first token in list)
  if(tokenList.length > 0) {
    const tokenAddr = tokenList[0];
    const [bullPool, bearPool] = await contract.getRoundInfo(tokenAddr);
    console.log(`Current pools for token ${tokenAddr}: Up=${bullPool} Down=${bearPool}`);
  }
  ```
  The above snippet assumes the contract has those functions. If function names differ, adapt accordingly.

### Executing Transactions (Bets and Claims)

When a user interacts (places a bet, or claims winnings), the frontend must send a transaction via the user’s wallet:

- **Placing a Bet (Prediction):** Typically, a user will select a token and a direction (e.g., “Up” or “Down”), and an amount to stake (likely in a stablecoin like USDC, or possibly ETH). Let’s assume bets are in USDC (since everything is priced in USDC). The contract function might be `placeBet(address token, bool direction, uint256 amount)` where `direction=true` means betting price will go up, `false` means down.

  Steps for the frontend:
  1. Ensure the user has approved the contract to spend their USDC (ERC-20 approval). If not, prompt an approval tx:
     ```js
     const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
     await usdcContract.approve(CONTRACT_ADDRESS, betAmount);
     ```
     Wait for confirmation of approval (UI feedback during this).
  2. Call the bet function:
     ```js
     await contract.connect(signer).placeBet(tokenAddr, true, betAmount);
     ```
     This will prompt the user’s wallet to confirm the transaction. The contract will transfer the USDC from the user (hence needing approval) into its pool and record the bet.

  Example:
  ```js
  const tokenAddr = selectedTokenAddress;
  const betAmount = ethers.utils.parseUnits("50", 6); // 50 USDC (6 decimals)
  const direction = true; // betting "Up"

  // Approve USDC if needed
  const allowance = await usdcContract.allowance(userAddress, CONTRACT_ADDRESS);
  if(allowance.lt(betAmount)) {
      const txApprove = await usdcContract.connect(signer).approve(CONTRACT_ADDRESS, betAmount);
      await txApprove.wait();
      console.log("USDC approved");
  }

  // Place bet
  const txBet = await contract.connect(signer).placeBet(tokenAddr, direction, betAmount);
  console.log("Bet transaction sent:", txBet.hash);
  await txBet.wait();
  console.log("Bet confirmed on-chain");
  ```
  After this, the user’s funds are in the contract’s pool. The UI should update the pool sizes (perhaps by calling `getRoundInfo` again after a few seconds or waiting for a BetPlaced event).

- **Claiming Rewards:** After a round ends and if the user won, they should claim their payout. The contract might have a function `claimReward(address token, uint roundId)` or simply `claim(address token)` if it tracks unclaimed rewards per user. The UI would call this with the user’s signer:
  ```js
  const txClaim = await contract.connect(signer).claimReward(tokenAddr);
  await txClaim.wait();
  console.log("Rewards claimed");
  ```
  The contract would then transfer the owed amount of USDC (or other reward token) back to the user. The frontend should update the user’s balance accordingly (likely by listening for the Transfer event or re-reading their balance).

- **Handling Multiple Tokens:** If the user can place bets on multiple tokens concurrently (likely yes), the UI should specify which token’s market the action is for in each call. The contract likely segregates state by token (so each token has its own round pools, etc.). Thus, `placeBet(tokenA, true, amount)` affects only tokenA’s market.

- **Web3.js Differences:** Using Web3.js, the calls are similar but use callbacks or `.send()` for transactions. For brevity, we stick to ethers.js style which is common in modern dApps.

### Displaying Odds and Outcomes

- **Real-Time Odds:** As bets come in, the odds (or payout multipliers) change. The UI can poll `getRoundInfo` periodically or subscribe to an event (if the contract emits something like `BetPlaced(address user, address token, bool direction, uint amount)`). Upon catching an event or poll interval, update the displayed odds. This gives users immediate feedback if, say, a big bet just came in on one side.

- **Outcome Resolution:** When a round ends at the scheduled time, the contract will record the final price and determine winners. It might emit an event such as `RoundSettled(address token, uint roundId, uint256 closingPrice, bool outcome)` where outcome might indicate which side won (or this can be inferred by comparing closingPrice to opening price). The frontend can listen for `RoundSettled` and then inform users who participated in that round that they can claim, or even auto-update their UI state from “bet pending” to “won/lost”.

- **Historical Data:** For showing past rounds (e.g., last 5 days outcomes), the UI might query events or the contract might store a history. A function like `getRoundHistory(token, roundId)` could return past price or outcome. If not, events are the way. The contract events could include `BetPlaced`, `RoundSettled`, and `RewardClaimed`. The frontend could use a subgraph or direct event queries to build a history view.

### Example: Integrating Countdown and Odds in UI

Let’s illustrate how the frontend might continuously display the countdown and odds using simple JS (pseudo-code for clarity):

```js
async function refreshUI() {
  // Assume selectedToken is the current market user is viewing
  const [upPool, downPool] = await contract.getRoundInfo(selectedToken);
  const totalPool = upPool.add(downPool);
  let upOdds, downOdds;
  if(upPool.gt(0)) upOdds = Number(totalPool.mul(100).div(upPool)) / 100;  // e.g., 1.5
  if(downPool.gt(0)) downOdds = Number(totalPool.mul(100).div(downPool)) / 100; // e.g., 2.0
  document.getElementById("upOdds").innerText = upPool.gt(0) ? upOdds + "x" : "-";
  document.getElementById("downOdds").innerText = downPool.gt(0) ? downOdds + "x" : "-";

  const secondsLeft = await contract.getRoundCountdown();
  document.getElementById("timer").innerText = formatSeconds(secondsLeft.toNumber());
}

// Refresh every 5 seconds
setInterval(refreshUI, 5000);
```

This periodically calls the contract to update the page. A more sophisticated approach is event-driven:
- Listen for `BetPlaced` events and update odds immediately when an event is received.
- Update the timer every second locally (since we know the end time from one call, we don’t need to keep calling the contract every second). For example, call `getRoundEndTime` once, then use `setInterval` to decrement a local counter each second.

### Handling Transactions in UI

- Provide user feedback: When a user clicks “Place Bet”, after calling the contract, show a pending spinner and wait for `.wait()` on the transaction promise. On success, show a success message or update their dashboard (their bet is now active). If the transaction fails or is rejected, catch the error and show a message (e.g., “Transaction rejected” or parse the revert reason if any).

- Gas and network: Since this is on Optimism, transactions are fast and cheap, but the UI should still indicate that a transaction might take a few seconds. Ensure the user’s wallet is connected to Optimism network (chain ID 10 for mainnet, or the testnet ID for Optimism Goerli/Sepolia). If not, prompt network switch.

- Using the contract’s ABI: The front-end should import the ABI of the deployed contract (likely from the build artifacts) to create the ethers.js Contract instance. Ensure the contract address is correctly set for the environment (testnet vs mainnet).

In summary, the frontend communicates with the contract through standard calls and transactions. All dynamic info shown in the UI (token list, odds, countdowns, results) comes from live contract data or events, ensuring the demo reflects the actual contract state. By following the examples above, developers can integrate the contract methods with UI components (dropdowns, buttons, displays) to provide a seamless user experience.

## 7. Security Considerations

**Overview:** The platform must be secure against various potential attack vectors, especially since it involves financial predictions and on-chain value. Key considerations include preventing price manipulation of the Uniswap feed, ensuring fair play (no one can exploit timing or contract bugs to win unfairly), and managing the risks of the proxy upgradeability. This section outlines known attack vectors and how our design mitigates them, as well as general best practices to maintain security.

### Price Manipulation and Oracle Security

- **Flash Loan Attacks on Price:** A common attack is using a flash loan to manipulate the DEX price briefly at the round’s end, so the outcome flips to the attacker’s favor. Uniswap v3/v4 oracles (TWAPs) are typically used to mitigate this, as they make short spikes expensive to maintain ([Uniswap v4 Truncated Oracle Hook](https://blog.uniswap.org/uniswap-v4-truncated-oracle-hook#:~:text=making%20it%20less%20secure)) ([The Full Guide to Price Oracle Manipulation Attacks](https://www.cyfrin.io/blog/price-oracle-manipulation-attacks-with-examples#:~:text=Some%20examples%20of%20oracles%20are%3A,Chainlink%2C%20Tellor%2C%20or%20Uniswap)). In our design, we mitigate price manipulation in several ways:
  - We use a **significant trade size (10,000 USDC)** for price queries, which means an attacker would need to inject a lot of capital to move the price that far. If an attacker tries to manipulate price with a flash loan, the contract’s price query simulating a 10k trade would likely average out the price rather than taking a momentary spike from a tiny trade.
  - We likely could incorporate a short TWAP (time-weighted average price) around the round end moment. For instance, take an average price over the last few minutes of the round. This would require fetching two Uniswap observations (e.g., 5 minutes apart) and computing the average tick. Even if not currently implemented, this is a recommended approach by Uniswap for oracle safety ([Oracle | Uniswap](https://docs.uniswap.org/concepts/protocol/oracle#:~:text=All%20Uniswap%20v3%20pools%20can,chain%20use%20cases)).
  - We restrict supported tokens to those with **deep liquidity**. Highly liquid pools are much harder (costlier) to manipulate ([Uniswap v4 Truncated Oracle Hook](https://blog.uniswap.org/uniswap-v4-truncated-oracle-hook#:~:text=making%20it%20less%20secure)). For example, WETH/USDC with tens of millions in liquidity cannot be moved significantly without huge capital. Illiquid meme tokens are excluded or delisted to prevent easy manipulation.

- **Liquidity Threshold:** The contract may enforce that the pool’s liquidity or token’s market cap is above a threshold before allowing betting. If liquidity drops (say a large LP withdraws), the DAO can pause that token or the contract can automatically disable it for new rounds if detected (and alert the DAO).

- **Economic Incentive Alignment:** The typical oracle manipulation scenario is when the potential payout from the protocol is less than the cost to manipulate the price, attackers won’t do it ([The Full Guide to Price Oracle Manipulation Attacks](https://www.cyfrin.io/blog/price-oracle-manipulation-attacks-with-examples#:~:text=Some%20examples%20of%20oracles%20are%3A,Chainlink%2C%20Tellor%2C%20or%20Uniswap)). We try to keep it that way: if someone bet an amount X, the max they can win is related to X and the pool, whereas to guarantee a win by manipulation, they might have to move the price on Uniswap by spending or borrowing a much larger amount than X (especially with 10k USDC queries and deep liquidity). This dissuades rational attackers.

- **Monitoring:** The DAO or an automated agent might monitor price feeds for anomalies. If an attacker does attempt something, emergency measures (like pausing the contract via DAO, or halting a particular round) could be taken. However, these would only be used in extreme cases to avoid disrupting normal operations.

### Fair Play and User Exploits

- **Front-Running End of Round:** If users can detect when a round is about to end (they can, it’s scheduled) and if betting is allowed until the last second, someone might try to place a bet just before the cutoff with knowledge of price movement. To mitigate this, the contract might enforce a **“lockout period”** before round end during which no new bets can be placed (e.g., last 5 minutes of the round no new entries). This prevents someone from seeing an uptrend at 23:59 and betting up at 23:59:50. If such a lockout exists, the contract will reject bets in that window.

- **Transaction Ordering (Mempool):** Even with a fixed end time, if two users bet opposite directions in the final block, one might know the price outcome already if that block’s timestamp is at or past the cutoff. We largely avoid this by disallowing betting exactly at the cutoff (i.e., bets must be strictly before round end). Additionally, since the outcome is determined by price, not by who bets last, typical front-running of other bets is less of a concern (except as it might affect odds, which isn’t directly an attack but normal competition).

- **Admin Abuse:** We rely on the DAO for upgrades and settings. To prevent abuse, the DAO is a multi-sig with community oversight. Additionally, any upgrade to the logic contract would be subject to timelocks/governance votes (if a full DAO governance is in place). This reduces the risk of a rogue developer upgrading the contract to siphon funds. Furthermore, by transferring ownership to the DAO multi-sig ([Using a Gnosis Safe to Upgrade Upgradable Contracts | Developer Jesse](https://developerjesse.com/2025/01/10/upgradable-contract-with-gnosis.html#:~:text=Transfer%20Ownership%20of%20the%20ProxyAdmin,Contract)), no single individual can arbitrarily upgrade or pause the contract.

- **Proxy Upgrade Risk:** Upgradeable contracts carry the risk that a bad implementation could accidentally wipe state or introduce vulnerabilities. We mitigate this by carefully reviewing upgrade code and possibly using a timelock + multi-sig for executing upgrades (so the community can audit the new code during the timelock period). Also, the proxy admin (DAO) should never be an EOA of a single person, to avoid single point failure (we used a multi-sig).

- **Re-Entrancy and External Calls:** Our contract interacts with ERC20 tokens (transfers) and Uniswap contracts. We must ensure to follow the Checks-Effects-Interactions pattern to avoid re-entrancy. For example, when the contract pays out a user, it might call an ERC20 transfer to the user. That ERC20 could theoretically call back if it’s a malicious token. In our case, we mostly deal with standard tokens (USDC, etc.) that are well-behaved (no reentrancy on transfer), but as a best practice the contract should use ReentrancyGuard on functions like claimReward. Also, when calling Uniswap’s quoter or pool, we use staticcall or view calls, which should not change state in our contract during the external call. And we do those reads before updating our own state to avoid any interwoven external call during critical state changes.

- **Integer Precision and Overflow:** The contract uses appropriate data types (Solidity ^0.8 has built-in overflow checks). We take care with different decimals of tokens. USDC has 6 decimals, WETH 18, etc. The price computation needs to handle that (likely by scaling values). Errors in math could be exploited (for example, if we mis-handle a token with very low decimals, the price might compute incorrectly giving someone advantage). We mitigate by normalizing everything to a common base (like using 6 or 18 decimals consistently in calculations) and testing each token’s scenario.

- **Withdrawal of Funds:** All funds (user bets) are held in the contract during the round. Only rightful winners should get funds after. The contract likely has no function to withdraw funds arbitrarily (except possibly the DAO withdrawing accumulated fees). To be safe, the DAO could only withdraw a small platform fee that’s collected, not users’ principal which should always either be paid out to winners or refunded. We avoid having an “admin can drain all funds” function – that would defeat trust. If using OpenZeppelin Ownable, ensure no `withdraw()` exists or if it exists (for fees), it’s limited to fees.

- **Deliberate Malicious Tokens:** If we allowed any user to list any token, someone could list a token that has a malicious behavior (like its transfer always reverts except under certain conditions, or it traps the contract by consuming all gas on transfer). By restricting token listing to DAO or doing thorough checks (like ensuring the token’s contract code is standard ERC20, perhaps by checking bytecode against known implementations), we avoid integrating malicious tokens. All preloaded tokens (USDC, WETH, etc.) are known safe tokens.

### Game Theory and Economic Attacks

- **Sybil or Collusion:** Because this is a pari-mutuel style system (players betting against each other), collusion isn’t really an issue – if many collude to bet on one side, they don’t gain an unfair advantage; in fact, they reduce their own payouts by saturating one side. A Sybil (multiple addresses by same user) doesn’t give extra benefit beyond what one address could do, since payouts are proportional to bet regardless of address count.

- **Denial of Service:** Could an attacker prevent the game from progressing? Since rounds advance automatically by time, the only way to DOS would be to stop users from transacting (which would require spamming the network or something, beyond scope of our contract). The contract functions themselves are reasonably simple and shouldn’t hit block gas limits unless an extreme number of tokens or bets are open (if we stored each bet individually, but likely we aggregate bets per side to avoid too much data). Even settlement (price fetch and looping winners) is probably optimized.

- **Eventual Consistency:** If no one calls the contract for a long time, rounds could pass without settlement. This is not a direct attack, but a situation to consider. The next user action will trigger settling of past rounds. We ensure that the contract can handle catching up (e.g., if 10 daily rounds passed with no bets, when a new bet comes in, it should realize the last active round ended long ago and maybe skip those empty rounds or mark them as closed with no participants). This doesn’t cause a security issue per se, but it should not break the logic.

### Auditing and Testing

- The contracts should be audited or at least thoroughly tested. Unit tests should cover scenarios: normal betting and claiming, edge cases like exactly one bettor (should get their money back as they effectively bet against nobody, or however defined), price tie (if price stays the same, is it considered up or down or a push?), and large values.

- **Preventing Known Vulnerabilities:** We use OpenZeppelin libraries for safe math, ownership, reentrancy guard, etc. We avoid using `tx.origin` or other insecure auth methods, rely on `msg.sender` against stored owner addresses for access control. No use of deprecated Solidity features.

- **Proxy Storage Collisions:** With upgradeable proxy, ensure that the logic contract’s state variables line up with proxy storage and that we don’t accidentally introduce storage layout changes in upgrades that could corrupt data. Use the approved patterns (we likely used OpenZeppelin’s UUPS or Transparent upgrade which manage that). The DAO should be cautious when approving an upgrade that changes storage structure (this is more a development process issue).

### Reference and Inspiration

Our approach to oracle security is inspired by known DeFi practices. Uniswap themselves highlight that using liquidity pool spot prices as oracles can be risky if not designed carefully ([The Full Guide to Price Oracle Manipulation Attacks](https://www.cyfrin.io/blog/price-oracle-manipulation-attacks-with-examples#:~:text=Some%20examples%20of%20oracles%20are%3A,Chainlink%2C%20Tellor%2C%20or%20Uniswap)). That’s why we incorporate volume (10k USDC) and possibly time-weighting. Additionally, Uniswap v4’s introduction of hooks like the **truncated oracle hook** is a testament to oracle manipulation concerns; it limits how much price can change in one block ([Uniswap v4 Truncated Oracle Hook](https://blog.uniswap.org/uniswap-v4-truncated-oracle-hook#:~:text=A%20truncated%20price%20oracle%20uses,are%20less%20subject%20to%20manipulation)). While we haven’t implemented a custom hook (that’s within Uniswap’s pool, not our contract), understanding these measures guided our design.

In conclusion, the system’s security comes from multiple layers: using battle-tested components (Uniswap, OpenZeppelin libraries), limiting control to a multi-sig DAO, aligning economic incentives to deter manipulation, and implementing logical checks (liquidity requirements, time lockouts) to close loopholes. We will continuously monitor and update the contract via DAO governance if any new threats are discovered, maintaining a fair and secure environment for all participants.

## 8. Testing & Troubleshooting

**Overview:** This section provides guidance on how to test the contract deployment and functionality on the Optimism testnet (and locally), and how to troubleshoot common issues that might arise during deployment or integration. We include tips for debugging transaction errors, common pitfalls (and their fixes), and ensure you have the addresses of common tokens on Optimism for testing.

### Deployment on Optimism Testnet

- **Choosing a Test Network:** Optimism has a couple of testnets. The latest is **OP Sepolia** (L2 on top of Sepolia L1), and previously **OP Goerli** (on Goerli L1) was used. Check Optimism docs for current testnet info. As of writing, OP Sepolia is available ([Contract Addresses | Optimism Docs](https://docs.optimism.io/superchain/addresses#:~:text=,OP%20Sepolia%20%28L2)). For practical purposes, using Optimism Goerli (if still operational) or OP Sepolia will work similarly. We’ll assume OP Goerli for example (chain ID 420, or OP Sepolia chain ID 11155420).

- **Setting Up Environment:** Add the Optimism testnet network to your Web3 provider. For instance, for Hardhat:
  ```js
  networks: {
    optimism_goerli: {
      url: "https://goerli.optimism.io",
      accounts: [PRIVATE_KEY]
    }
  }
  ```
  Or for Sepolia Optimism:
  ```js
  networks: {
    optimism_sepolia: {
      url: "https://sepolia.optimism.io",
      accounts: [PRIVATE_KEY]
    }
  }
  ```
  Ensure your account has test ETH on that network (you can get from Optimism’s faucet or bridging from L1 testnet).

- **Deploying to Testnet:** Use the same scripts as for mainnet, just switch the network. For example: `npx hardhat run --network optimism_goerli scripts/deploy.js`. This should deploy your implementation and proxy. Watch the transactions on the Optimism block explorer (goerli-optimism.etherscan.io or the official Optimism explorer). Verify that contract creation succeeded.

- **Using Test Tokens:** You’ll need the addresses of test tokens (USDC, WETH, etc.) on the testnet. Often, on testnets, not all mainnet tokens exist unless someone deployed them or bridged them. Optimism Goerli might have **bridged Goerli USDC** (address possibly `0x94B008Aa005...` similar to mainnet’s bridged address but on testnet, or check Circle’s docs: OP Sepolia USDC is at `0x5fd84259d66Cd46123540766Be93DFE6D43130D7` ([USDC on Test Networks - Circle Docs](https://developers.circle.com/stablecoins/usdc-on-test-networks#:~:text=USDC%20on%20Test%20Networks%20,Polkadot%20Westmint%2C%20Asset%20ID))). If testnet lacks a certain token, you have options:
  - Deploy a simple ERC20 mock for testing and use that in place of USDC.
  - Use an existing stable like DAI if available (Goerli had an Optimism DAI test token).
  - On Optimism Goerli, the proxy for USDC (bridged from Goerli ETH testnet) was `0x0B801CbBaB0B0e2F50BCaBbF556Characteristics...` (this is just illustrative, you should confirm current addresses). Refer to the Optimism docs or Chainlink docs for test token addresses ([USDC on Test Networks - Circle Docs](https://developers.circle.com/stablecoins/usdc-on-test-networks#:~:text=USDC%20on%20Test%20Networks%20,Polkadot%20Westmint%2C%20Asset%20ID)).

- **Testing Price Feeds:** Uniswap v3 has been deployed on Optimism Goerli. The Uniswap Factory on Optimism Goerli address is given in Uniswap docs ([Optimism Deployments | Uniswap](https://docs.uniswap.org/contracts/v3/reference/deployments/optimism-deployments#:~:text=ProxyAdmin,0x42B24A95702b9986e82d421cC3568932790A48Ec)) (for example, it shows an OP Sepolia address for factory as `0x8CE191193D15ea94e11d327b4c7ad8bbE520f6aF` ([Optimism Deployments | Uniswap](https://docs.uniswap.org/contracts/v3/reference/deployments/optimism-deployments#:~:text=UniswapV3Factory,0xD7303474Baca835743B54D73799688990f24a79D))). On Optimism Goerli, likely the same deployment addresses or similar. Ensure your contract uses the testnet factory address for pool lookup. Alternatively, for simplicity, you can deploy your own Uniswap v3 instance locally or use mainnet fork for testing price logic. But testing on the actual Optimism testnet with Uniswap’s contracts gives more realism.

- **Simulating Rounds:** Once deployed, simulate a full round:
  1. Add a token (if not preloaded). For example, if you deployed a mock token, call `addToken` via your owner (which is your deployer on testnet initially, unless you set DAO).
  2. Place a couple of bets from different accounts. Use small amounts since it’s testnet. Verify events and storage values (`getRoundInfo`).
  3. Fast-forward time if possible. On a local test (Hardhat Network), you can increase time to just after round end (e.g., `evm_increaseTime(86410)`). On an actual testnet, you obviously wait until the round time passes (you could shorten round duration in the contract for test purposes, e.g., set daily to 1 hour in a special test deployment).
  4. After round ends, attempt to resolve or place a new bet which triggers resolution. Check that the outcome is determined correctly.
  5. Have the winning account call `claimReward` and verify they receive the payout (their token balance increases).

- **Testing Upgrades:** Since this is upgradeable, test performing an upgrade on testnet. Deploy a new implementation (maybe one that has a trivial change or new function), and then as the ProxyAdmin (your deployer or DAO if you transferred it) call the upgrade. Make sure it succeeds and state is intact. This ensures your upgrade flow via Hardhat or scripts works before doing it on mainnet.

### Debugging Tips

- **Transaction Reverted:** When a transaction reverts, get the revert reason. Hardhat and ethers usually throw an error with the reason string if the contract provided one (e.g., “Not authorized” or “Round expired”). If not, use Hardhat’s console with `await contract.callStatic.yourFunction(params)` to simulate and get a reason. Common reasons:
  - “Not authorized/Ownable: caller is not the owner” – you called an admin function from a non-owner account. Solution: use the DAO account or ensure the correct signer.
  - “ERC20: insufficient allowance” – you forgot to approve the token or not enough allowance. Solution: increase allowance.
  - “ERC20: transfer amount exceeds balance” – user doesn’t have enough token to bet.
  - “Betting closed for this round” – you tried to bet after the cutoff time or after round ended. The contract correctly prevented it. Solution: ensure you’re within the allowed betting window.
  - “Token not supported” – the token address passed isn’t in the supported list or was delisted. Check that you use correct addresses and that it’s added.

- **Incorrect Data on UI:** If the frontend displays wrong values (e.g., countdown shows negative, odds not updating):
  - Check that the frontend is calling the right network (pointing to testnet RPC vs mainnet by accident).
  - Ensure the contract addresses and ABIs match your deployment. A mismatch ABI (from a different version) could cause decoding issues.
  - For countdown, ensure the system clock vs blockchain time sync. Remember blockchain timestamps might not exactly equal wall-clock time; minor differences are fine, but if your UI shows - - : - -, probably the call failed. Use console logs in the web app to debug the values returned from contract.

- **Events not Emitting or Not Caught:** If you rely on events, ensure you have the event filters correct. Sometimes, using ethers `contract.on("BetPlaced", ...)` can silently fail if the app refreshes. Consider using the provider directly or a library like ethers EventListener or even the Graph for robust data. For troubleshooting, you can manually fetch past events:
  ```js
  const events = await contract.queryFilter("BetPlaced", startBlock, endBlock);
  console.log(events);
  ```
  to see if events were emitted.

- **Proxy Issues:** A common mistake is interacting with the implementation address instead of the proxy. Always use the proxy address in your frontend and tests when calling functions (except when specifically testing upgrade by calling proxy admin). If you call the implementation directly, state won’t change (it’s not the proxy’s storage) and things will seem broken. Ensure you have the proxy’s ABI combined with implementation’s ABI (usually the same ABI file works since proxy delegates). If using ethers, just use the implementation ABI and proxy address to create the Contract object.

- **Optimism Quirks:** On Optimism, the concept of “timestamp” is the same as Ethereum L1 (propagated), so no issues there. But gas price and finalization are different – typically transactions confirm in ~2s, and are final. If using Hardhat’s optimism fork or an older Optimism Kovan, be aware those are outdated. Stick to the official ones.

- **Testing Edge Cases:** Test with edge values:
  - Bet extremely low amounts (1 wei of USDC, if that’s allowed, or 0 which should revert).
  - Bet extremely high (if you have the test tokens, try a very large number to ensure no overflow).
  - All users bet on one side and none on the other – ensure the contract either declares that side the winner by default or handles payout (if everyone chose “up” and it indeed goes up, they should just get their own money back plus maybe the other side’s which is 0, so effectively no profit, but no loss).
  - Price stays exactly the same – depending on spec, that might be considered a tie. Does contract handle that? Perhaps it might treat it as “down wins” or “up wins” by default if not coded. Ideally a tie could mean refund all. If not implemented, at least note it as a possible issue.

### Common Errors and Resolutions

- **“Invalid opcode” or “execution reverted without reason”**: This can happen if you hit an assert or a condition that doesn’t provide a reason. Or if you called a non-payable function with value. Double-check the function signature (if you accidentally did `contract.placeBet(..., { value: something })` while it expects an ERC20, that value is unused and might revert in proxy). Ensure you’re not sending ETH to a function that doesn’t accept it.

- **Deployment failures**: If deployment script fails:
  - Check constructor arguments for implementation (should be none or handled in initializer).
  - If using Hardhat Upgrades, make sure the logic contract’s constructor is empty (must use initialize instead, since proxies can’t call constructors). Hardhat Upgrades will warn if you have a constructor.
  - Check that your deployed bytecode isn’t too large (shouldn’t be an issue unless contract is huge, Optimism has high code size limit anyway).
  - If a library like OpenZeppelin is not linked, make sure to add the appropriate linking or fully qualify import so Hardhat knows to link.

- **Proxy Admin confusion**: If you try to call admin functions on Transparent proxy using the proxy address, nothing will happen because Transparent Proxy will route calls differently: calls from non-admin go to implementation, calls from admin go to admin functions (but those admin functions are just `upgradeTo`, etc., which usually you don’t directly call via UI). Use Hardhat’s `upgrades` or directly interact with ProxyAdmin contract for upgrades. For simply using the dApp, always treat the proxy as the contract.

- **Token decimals mismatch**: If you see odd values like your 50 USDC bet showing as 0.00005 in contract data, it might be because you forgot to use the correct decimals. Always convert to the token’s smallest unit for on-chain. USDC is 6 decimals, so 50 is `50 * 10^6 = 50000000`. Using `parseUnits("50", 6)` as shown is correct.

- **Optimism specific**: Occasionally, tools might not decode revert reason on Optimism due to how the L2 executes. If you suspect a revert and don’t get a reason, try using the Optimism block explorer to debug the transaction. Optimistic Etherscan often shows the internal failure message.

### Token Addresses on Optimism (Mainnet Reference)

For completeness and to avoid confusion when moving to mainnet, here are the Optimism **mainnet** ERC-20 addresses for some popular tokens (you can use these for reference or when configuring the contract for mainnet deployment):

- **USDC (USD Coin)** – Optimism address: `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=,opens%20in%20a%20new%20tab)) (this is the native Circle-issued USDC on Optimism; note that an older bridged USDC.e exists at `0x7F5c...C31607`, but it’s deprecated in favor of the native one).
- **WBTC (Wrapped BTC)** – Optimism address: `0x68f180fcCe6836688e9084f035309E29Bf0A2095` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Wrapped%20BTC%20WBTC0x2260fac5e5542a773aa44fbcfedf7c193bc2c599%20,opens%20in%20a)).
- **WETH (Wrapped Ether)** – Optimism address: `0x4200000000000000000000000000000000000006` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Wrapped%20BTC%20WBTC0x2260fac5e5542a773aa44fbcfedf7c193bc2c599%20,opens%20in%20a)) (Optimism’s Canonical WETH, note the distinctive address).
- **LINK (Chainlink)** – Optimism address: `0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Chainlink%20LINK0x514910771af9ca656af840dff83e8264ecf986ca%20,opens%20in%20a%20new%20tab)).
- **WLD (Worldcoin)** – Optimism address: `0xdC6fF44d5d932Cbd77B52E5612Ba0529DC6226F1` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Worldcoin%20WLD0x163f8C2467924be0ae7B5347228CABF260318753%20,opens%20in%20a%20new%20tab)).
- **DAI (Dai Stablecoin)** – Optimism address: `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Dai%20Stablecoin%20DAI0x6B175474E89094C44Da98b954EedeAC495271d0F%20,opens%20in%20a%20new)).
- **USDT (Tether USD)** – Optimism address: `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Tether%20USD%20USDT0xdac17f958d2ee523a2206206994597c13d831ec7%20,opens%20in%20a%20new)).
- **AAVE (Aave Token)** – Optimism address: `0x76FB31fb4af56892A25e32cFC43De717950c9278` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Aave%20Token%20AAVE0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9%20,opens%20in%20a%20new%20tab)).
- **SNX (Synthetix Network Token)** – Optimism address: `0x8700dAEc35af8FF88c16BdF0418774Cb3D7599B4` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Synthetix%20SNX0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f%20,opens%20in%20a%20new)).
- **UNI (Uniswap)** – Optimism address: `0x6fd9d7AD17242c41f7131d257212c54A0e816691` ([Bridged token addresses | Optimism Docs](https://docs.optimism.io/superchain/tokenlist#:~:text=Uniswap%20UNI0x1f9840a85d5af5bf1d1762f925bdaddc4201f984%20,opens%20in%20a%20new)).

These addresses are useful when setting up the contract’s token list on mainnet or for cross-referencing in block explorers. Always double-check from official Optimism docs or Etherscan if any changes.
