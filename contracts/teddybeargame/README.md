# Teddy Bear Prediction Platform Game (Draft)

**Status: Draft — This is an early-stage prototype under active development.**  
**Use at your own discretion. For testing, fun, and demonstration purposes only.**

## Introduction

This smart contract platform allows participants to skillfully predict the future value of various tokenized assets over a defined time period. Inspired by the experience of winning a teddy bear at a fair game, participants purchase tickets to show their conviction in a particular outcome. At the end of the round, those who predicted correctly can redeem their tickets for “Teddy Bear NFTs.” These NFTs, much like a physical teddy bear prize, can then be conveniently exchanged back for USDC at a known rate, eliminating the need for a third-party resale market.

**Key Idea:**  
- **Skill-based Prediction:** Players buy tickets early (cheap) or later (more expensive) based on their confidence and skill in forecasting asset prices.  
- **Teddy Bear NFTs as Prizes:** Rather than directly receiving funds, winners receive Teddy Bear NFTs, which can be exchanged for USDC. This ensures the system functions more like a fair’s skill game rather than a direct transfer of one side’s funds to another.  
- **Market Signals and Fun:** By observing how many people choose a particular outcome and how much they invest in their predictions, this platform provides meaningful market signals. Making it fun encourages broader participation, which ultimately can offer more reliable predictive insights into real-world and digital assets.

## Core Mechanics and Mathematics

### Time, Ticket Prices, and Skill Expression

**Time Intervals:**  
Rounds can last any duration—30 minutes, 1 year, or anything in between. The contract uses Ethereum block timestamps to measure time. For a 30-minute round (e.g., from 1:00 to 1:30), ticket purchases are allowed until approximately 95% of the round has elapsed. This ensures players do not wait until the final second for near-certain outcomes, preserving the element of skill and timely decision-making.

- Example for 30 Minutes:  
  - Start: 0% elapsed at 1:00.  
  - End: 100% elapsed at 1:30.  
  - Cutoff for buying tickets: ~95% elapsed, around 1:28.5.

- Example for 1 Year:  
  If the interval is one year (~365 days), then the cutoff occurs after ~95% of that year has passed, leaving the final ~5% of time unavailable for new ticket purchases. This proportionally scales to any interval.

**Ticket Price Formula:**  
Tickets start at a base price of 5 USDC. As the round progresses, the price rises linearly, approaching 10 USDC at the cutoff point.

If we define:

- \( T \) = total round duration (e.g., 1800 seconds for 30 minutes)  
- \( t \) = elapsed time (seconds since the round started)  
- \( p(t) \) = price of a ticket at time \( t \)  
- Cutoff time: \( t_{cutoff} = 0.95 \times T \) (95% of the interval)

Then:

\[
p(t) = 5\ \text{USDC} + (10\ \text{USDC} - 5\ \text{USDC}) \times \frac{t}{t_{cutoff}}
= 5\ \text{USDC} + 5\ \text{USDC} \times \frac{t}{0.95T}
\]

This means at the start (t=0), \( p(0) = 5 \) USDC. Near the cutoff (t = \(0.95T\)), \( p(t) \approx 10 \) USDC.

### Teddy Bear NFTs and Redemption

At the end of the round, the contract compares the final asset price (obtained via an on-chain price oracle, e.g., Uniswap’s oracle) with the initial price. Those who predicted the correct direction can redeem their tickets for Teddy Bear NFTs on a one-to-one basis.

Each Teddy Bear NFT is designed to be sold back to the platform for 10 USDC. This arrangement is analogous to winning a teddy bear at a fair and then having a convenient way to sell it at a known price—except here, it’s done on-chain for convenience.

**Equations for Post-Round Outcomes:**

- Let’s say:  
  - \( U \) = total USDC contributed by participants predicting “Up”  
  - \( D \) = total USDC contributed by participants predicting “Down”  
  - The winning side redeems each ticket for 1 Teddy Bear NFT.  
  - Each Teddy Bear NFT can be sold at 10 USDC (minus any applicable DAO fee).

If “Up” wins, players who bought “Up” tickets can claim Teddy Bear NFTs and each NFT can be sold for 10 USDC. The effective value they obtain correlates to how many participants were on the other side, providing valuable market information and demonstrating participant conviction.

### Fees and DAO Controls

A small fee (initially zero for tickets, 3% for Teddy Bear NFT sales) goes to a DAO treasury. Over time, the DAO (or “Maintainer”) may adjust parameters (0% to 10% fee) to support development and ensure long-term sustainability. These parameters and oracle addresses can be changed by the Maintainer, who eventually will be a DAO contract rather than a single individual.

### Example Scenario

**30-Minute Round Example:**

1. **Setup:**  
   - Asset: WBTC (Wrapped Bitcoin)  
   - Interval: 30 minutes (T = 1800 seconds)  
   - Initial price fetched at start: e.g., 20,000 USDC per WBTC.

2. **Participants Join Early:**  
   - At 1:00 (0% elapsed), tickets cost exactly 5 USDC. Suppose 10 players buy 1 ticket each predicting “Up”, for a total of 50 USDC.  
   - Meanwhile, 10 players predict “Down” also at the start, another 50 USDC. Now, U=50 USDC, D=50 USDC at start.

3. **As Time Progresses:**  
   - Closer to 1:28.5 (95% elapsed), tickets cost nearly 10 USDC. Some latecomers join the “Up” side with high conviction, adding another 100 USDC (at about 9.8 USDC per ticket). Now, U=150 USDC total and D=50 USDC total.

4. **End of Round (1:30):**  
   - The round ends, and we fetch the final WBTC price from the oracle.  
   - Suppose the final price is 20,100 USDC per WBTC, meaning “Up” predictions were correct.

5. **Redemption:**  
   - All “Up” tickets now can be redeemed for Teddy Bear NFTs at a 1:1 ratio. Let’s say the “Up” side purchased 30 tickets total. Each ticket yields 1 Teddy Bear NFT.  
   - Each Teddy Bear NFT can be sold back for 10 USDC. Before fees, 30 NFTs = 300 USDC.

   How is this sustainable? The total pool was U+D = 200 USDC. Since the price of bears is set at 10 USDC, and more USDC can be allocated from other system reserves or prior rounds (depending on system design), participants trust that the teddy bears maintain their 10 USDC redemption rate. The fee ensures a treasury builds up over time for the DAO.

   If a fee of 3% applies on selling Teddy Bear NFTs, then selling one NFT yields approximately 9.7 USDC. This slight discount funds the ongoing platform costs.

**Note:** During testing, parameters may differ, and long-term sustainability will rely on careful fee management and DAO governance. This is a draft mechanism, and the exact math may evolve.

## Why This Matters and Why It’s Fun

- **Skill-Based Participation:**  
  Your decision on when and which side to pick reflects your skill and confidence, not just random chance. Early decisions are cheaper but riskier; late decisions are pricier but better informed.

- **Market Intelligence:**  
  By watching the number and magnitude of participants’ predictions, observers gain insight into market sentiment. High participation and strong conviction in one direction might signal underlying fundamentals or market expectations. This can be invaluable for long-term holders, researchers, and asset issuers.

- **The Fun of a Fair:**  
  The entire structure resembles a classic fair experience: you buy a ticket, play a skill-based game (predicting asset movements), and if you do well, you receive a teddy bear (NFT). Only here, it’s digital and convenient. You can immediately resell your Teddy Bear NFT back to the platform for 10 USDC—no haggling, no third-party buyers needed.

- **Incentivizing Participation in Markets:**  
  Engaging, fun mechanics encourage more people to join. More players mean more data and better price discovery, which benefits everyone. Enhanced participation can strengthen market confidence, improve liquidity, and generate more reliable predictive indicators.

## Implementation Details and Current Status

- **Smart Contract Draft:**  
  The code is in early draft form. Addresses and parameters will be posted when test deployments are available. Expect frequent changes, upgrades, and improvements.

- **Oracles and Asset Integration:**  
  Initially, the contract fetches prices from a Uniswap-based oracle. The Maintainer (eventually a DAO) can change the oracle address. For example, if WBTC is the asset, the oracle will provide a USDC price. This ensures the platform can handle different asset classes and durations.

- **DAO and Maintainer Role:**  
  During testing, the Maintainer will be a single account for flexibility. Over time, ownership and control over fees, intervals, and oracle addresses will transfer to a DAO. This ensures community-driven governance and alignment with user interests.

- **Proposing Assets and Intervals:**  
  Anyone can propose a new asset or interval. The Maintainer must approve it. This allows continuous expansion of the platform’s offerings while maintaining oversight.

- **View Functions and Transparency:**  
  The contract will expose view functions to check:  
  - Current ticket price at any given elapsed time.  
  - Total number of participants on each side (Up/Down).  
  - Asset configurations, intervals, and fee percentages.  
  This transparency lets you make informed decisions before buying tickets.

## Disclaimer

This platform is experimental and in draft form. It is intended for demonstration, testing, and educational purposes. Do not rely on it for financial decisions or serious use cases at this time. The math, parameters, or oracles may change without notice. Use small amounts and have fun exploring!

---

We welcome feedback, issues, suggestions, and any constructive input. The goal is to refine this concept into a robust, skill-based prediction market that’s both informative and enjoyable. Your participation helps shape its future.
