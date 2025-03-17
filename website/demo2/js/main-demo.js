// MAIN-DEMO.JS – Plain JavaScript Simulation

document.addEventListener("DOMContentLoaded", function () {
  // Create and show loading overlay
  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "loading-overlay";
  loadingOverlay.innerHTML = `
    <div class="spinner"></div>
    <div class="loading-message">Initializing application...</div>
    <div class="loading-status">
      <div class="loading-status-bar" id="loading-progress"></div>
    </div>
  `;
  document.body.appendChild(loadingOverlay);

  const loadingProgress = document.getElementById("loading-progress");
  const loadingMessage = loadingOverlay.querySelector(".loading-message");

  // Update loading progress
  function updateLoadingProgress(percent, message) {
    if (loadingProgress) loadingProgress.style.width = percent + "%";
    if (loadingMessage) loadingMessage.textContent = message;
  }

  // ----------------------------
  // GLOBAL STATE
  // ----------------------------
  let isConnected = false;
  let selectedAccount = null;
  let currentAsset = null; // currently previewed asset
  let assetPreviewIntervalID = null; // for countdown
  let userDisconnected = false; // Flag to track user-initiated disconnections

  // Web3 related variables
  let web3 = null;
  let provider = null;
  let chainId = null;
  const CONTRACT_ADDRESS = "0xb8D1Ad0F6db11BD389120E969b36C0d93BFb84b5"; // Update with actual contract address

  // USDC contract addresses on different networks
  const USDC_CONTRACTS = {
    // Ethereum Mainnet
    "0x1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    // Optimism
    "0xa": "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
    // Polygon
    "0x89": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    // BSC
    "0x38": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
  };

  // USDC ABI (minimal, just what we need for balanceOf)
  const USDC_ABI = [
    {
      "constant": true,
      "inputs": [{ "name": "owner", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "name": "", "type": "uint256" }],
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [{ "name": "", "type": "uint8" }],
      "type": "function"
    }
  ];

  // Flag to track if Web3 libraries are loaded
  let web3LibrariesLoaded = false;

  // Network configuration
  const REQUIRED_NETWORK = {
    chainId: "0xa", // Optimism chainId in hex (10 in decimal)
    chainName: "Optimism",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: ["https://mainnet.optimism.io"],
    blockExplorerUrls: ["https://optimistic.etherscan.io"]
  };

  // Global history data
  const historyData = [
    { time: "1:00pm", result: "Predict Up won" },
    { time: "12:30pm", result: "Predict Down won" },
    { time: "12:00pm", result: "Predict Up won" },
    { time: "11:30am", result: "Predict Down won" },
    { time: "11:00am", result: "Predict Up won" },
    { time: "10:30am", result: "Predict Up won" },
    { time: "10:00am", result: "Predict Down won" },
    { time: "9:30am", result: "Predict Up won" },
    { time: "9:00am", result: "Predict Down won" },
    { time: "8:30am", result: "Predict Up won" },
  ];

  // ----------------------------
  // GLOBAL DOM ELEMENT REFERENCES
  // ----------------------------
  const walletToggleBtn = document.getElementById("wallet-toggle-btn");
  const portfolioBtn = document.getElementById("portfolio-btn");
  const establishedInput = document.getElementById("established-input");
  const establishedDatalist = document.getElementById("established-tokens");
  const userInput = document.getElementById("user-input");
  const userTokenDropdown = document.getElementById("user-token-dropdown");
  const addAssetBtn = document.getElementById("add-asset-btn");
  // const createAssetBtn = document.getElementById("create-asset-btn");
  const footerInfo = document.getElementById("footer-info");
  const howItWorksText = document.getElementById("how-it-works-text");
  const howOverlay = document.getElementById("how-it-works-overlay");

  // ----------------------------
  // GLOBAL ARRAYS FOR TOKENS
  // ----------------------------
  const establishedTokens = ["Bitcoin", "Chainlink", "Ethereum", "WorldCoin"];
  const userTokens = [
    "Adidas Tennis Shoe Collection",
    "Davak Townhouse",
    "Crypto Art Series",
    "Digital Real Estate",
    "Pokemon Card Set",
    "Strangest Building Book",
    "Tokenized Book",
    "Tokenized Game",
    "Vintage Comic Collection",
    "New Development in Dubai",
  ];

  // Store user-created assets with full details
  // const createdAssets = [];

  // ----------------------------
  // UTILITY FUNCTIONS
  // ----------------------------
  function pad(num) {
    return num.toString().padStart(2, "0");
  }

  function formatCountdown(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return { mins: pad(mins), secs: pad(secs) };
  }

  function updateFooterInfo() {
    if (!footerInfo) return;
    if (!isConnected) {
      footerInfo.innerHTML = `<span><span class="status-indicator status-disconnected"></span> Not connected</span>`;
    } else {
      const shortAddr =
        selectedAccount.slice(0, 4) + "..." + selectedAccount.slice(-4);

      // Get network name based on chainId
      let networkName = "Unknown Network";
      let networkClass = "network-unknown";
      let networkStatus = "";

      if (chainId) {
        const chainIdDec = parseInt(chainId, 16);
        switch (chainIdDec) {
          case 1:
            networkName = "Ethereum Mainnet";
            networkClass = "network-ethereum network-wrong";
            break;
          case 10:
            networkName = "Optimism";
            networkClass = "network-optimism network-correct";
            break;
          case 56:
            networkName = "BSC";
            networkClass = "network-bsc network-wrong";
            break;
          case 137:
            networkName = "Polygon";
            networkClass = "network-polygon network-wrong";
            break;
          case 42161:
            networkName = "Arbitrum One";
            networkClass = "network-arbitrum network-wrong";
            break;
          case 43114:
            networkName = "Avalanche C-Chain";
            networkClass = "network-avalanche network-wrong";
            break;
          case 5:
            networkName = "Goerli Testnet";
            networkClass = "network-testnet network-wrong";
            break;
          case 11155111:
            networkName = "Sepolia Testnet";
            networkClass = "network-testnet network-wrong";
            break;
          default:
            networkName = `Chain ID: ${chainIdDec}`;
            networkClass = "network-unknown network-wrong";
        }
      }

      footerInfo.innerHTML = `
        <span><span class="status-indicator status-connected"></span> ${shortAddr} | <a href="#" id="disconnect-link">Disconnect</a></span>
        <span><strong>Contract:</strong> ${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-6)}</span>
        <span><strong>Network:</strong> <span class="${networkClass}">${networkName}</span></span>
      `;

      // Add event listener to the disconnect link
      document.getElementById("disconnect-link").addEventListener("click", function (e) {
        e.preventDefault();
        if (confirm("Do you want to disconnect your wallet?")) {
          disconnectWallet();
        }
      });
    }
  }

  // ----------------------------
  // WALLET CONNECTION FLOW
  // ----------------------------
  async function showWalletOptions() {
    // Check if libraries are loaded first
    if (!web3LibrariesLoaded) {
      Swal.fire({
        title: "Loading Web3...",
        html: '<p class="pending-dots"><span>.</span><span>.</span><span>.</span></p><p>Please wait while we initialize wallet connections...</p>',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      try {
        // Load the web3 and provider libraries dynamically
        await loadWeb3Libraries();
        Swal.close();
      } catch (error) {
        console.error("Failed to load Web3 libraries:", error);
        Swal.fire({
          title: "Error",
          text: "Failed to load wallet connection libraries. Please try again.",
          icon: "error"
        });
        return;
      }
    }

    Swal.fire({
      title: "Connect Wallet",
      html: `
        <button id="metamask-option" class="swal2-styled">MetaMask</button>
        <button id="walletconnect-option" class="swal2-styled">WalletConnect</button>
      `,
      showConfirmButton: false,
      didOpen: () => {
        document
          .getElementById("metamask-option")
          .addEventListener("click", () => {
            Swal.close();
            setTimeout(() => {
              connectMetaMask();
            }, 500);
          });
        document
          .getElementById("walletconnect-option")
          .addEventListener("click", () => {
            Swal.close();
            setTimeout(() => {
              // WalletConnect integration can be added here in the future
              Swal.fire(
                "Coming Soon",
                "WalletConnect integration is coming soon!",
                "info"
              );
            }, 500);
          });
      },
    });
  }

  // Load Web3 libraries dynamically
  function loadWeb3Libraries() {
    return new Promise((resolve, reject) => {
      // Skip if already loaded
      if (web3LibrariesLoaded) {
        resolve();
        return;
      }

      // Check if Web3 is already available
      if (typeof Web3 !== 'undefined' && typeof detectEthereumProvider !== 'undefined') {
        web3LibrariesLoaded = true;
        resolve();
        return;
      }

      // If not loaded, dynamically load the scripts
      const web3Script = document.createElement('script');
      web3Script.src = 'https://cdn.jsdelivr.net/npm/web3@1.8.0/dist/web3.min.js';
      web3Script.onload = () => {
        const providerScript = document.createElement('script');
        providerScript.src = 'https://unpkg.com/@metamask/detect-provider/dist/detect-provider.min.js';
        providerScript.onload = () => {
          web3LibrariesLoaded = true;
          resolve();
        };
        providerScript.onerror = () => {
          reject(new Error("Failed to load detect-provider script"));
        };
        document.head.appendChild(providerScript);
      };
      web3Script.onerror = () => {
        reject(new Error("Failed to load Web3 script"));
      };
      document.head.appendChild(web3Script);
    });
  }

  async function connectMetaMask() {
    try {
      Swal.fire({
        title: "Connecting via MetaMask",
        html: '<p class="pending-dots"><span>.</span><span>.</span><span>.</span></p><p>Please confirm with your MetaMask wallet...</p>',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Check if MetaMask is installed
      provider = await detectEthereumProvider();

      if (!provider || !provider.isMetaMask) {
        Swal.fire(
          "MetaMask Not Found",
          "Please install MetaMask extension and refresh the page.",
          "error"
        );
        return;
      }

      // Reset the user disconnected flag when explicitly connecting
      userDisconnected = false;

      // Request account access
      const accounts = await provider.request({ method: 'eth_requestAccounts' });

      if (accounts.length === 0) {
        Swal.fire(
          "Connection Failed",
          "No accounts found or user denied access.",
          "error"
        );
        return;
      }

      // Get the connected chain ID
      chainId = await provider.request({ method: 'eth_chainId' });

      // Initialize Web3
      web3 = new Web3(provider);

      // Set global state
      selectedAccount = accounts[0];
      isConnected = true;

      // Update UI
      walletToggleBtn.textContent = "Disconnect Wallet";
      updateFooterInfo();

      Swal.fire(
        "Connected!",
        `Successfully connected to MetaMask with account ${selectedAccount.slice(0, 6)}...${selectedAccount.slice(-4)}`,
        "success"
      );

      // Set up event listeners for MetaMask events
      setupMetaMaskListeners();

      // Check if the user is on the correct network
      checkNetwork();

    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
      Swal.fire(
        "Connection Error",
        "Failed to connect to MetaMask: " + error.message,
        "error"
      );
    }
  }

  function setupMetaMaskListeners() {
    // Remove any existing listeners first
    if (provider) {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
      provider.removeListener('disconnect', handleDisconnect);
    }

    // Add new listeners with named functions so they can be removed later
    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);
    provider.on('disconnect', handleDisconnect);
  }

  // Handler functions for MetaMask events
  function handleAccountsChanged(accounts) {
    // If disconnected by user, don't auto-reconnect
    if (userDisconnected) return;

    if (accounts.length === 0) {
      // User disconnected their wallet from MetaMask
      disconnectWallet();
    } else {
      // User switched accounts
      selectedAccount = accounts[0];
      isConnected = true;
      updateFooterInfo();
      Swal.fire({
        title: "Account Changed",
        text: `Account switched to ${selectedAccount.slice(0, 6)}...${selectedAccount.slice(-4)}`,
        icon: "info",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000
      });
    }
  }

  function handleChainChanged(newChainId) {
    chainId = newChainId;

    // If user disconnected, don't auto-reconnect
    if (!userDisconnected) {
      checkConnectionStatus();
    }

    // Update the portfolio network banner if portfolio is open
    updatePortfolioNetworkBanner();

    updateFooterInfo();

    // Check if switched to correct network
    if (newChainId === REQUIRED_NETWORK.chainId) {
      // User switched to Optimism
      Swal.fire({
        title: "Optimism Network Detected",
        text: "You now have full access to all features",
        icon: "success",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000
      });
    } else if (isConnected) {
      // Only show network warning if actually connected
      checkNetwork();
    }

    // Don't reload the page - this is disruptive
    // Instead, ensure the UI reflects the current chain
    updateFooterInfo();
  }

  function handleDisconnect(error) {
    disconnectWallet();
  }

  // Function to check and restore wallet connection
  async function checkConnectionStatus() {
    // Don't check connection if explicitly disconnected by user
    if (userDisconnected) {
      return;
    }

    try {
      // Check if we're still connected
      const accounts = await provider.request({ method: 'eth_accounts' });

      if (accounts && accounts.length > 0) {
        isConnected = true;
        selectedAccount = accounts[0];
      } else {
        isConnected = false;
        selectedAccount = null;
      }

      updateFooterInfo();
    } catch (error) {
      console.error("Error checking connection status:", error);
      isConnected = false;
      updateFooterInfo();
    }
  }

  function disconnectWallet() {
    isConnected = false;
    selectedAccount = null;
    userDisconnected = true; // Set flag to indicate user-initiated disconnect

    // Remove event listeners if provider exists
    if (provider) {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
      provider.removeListener('disconnect', handleDisconnect);
    }

    web3 = null;
    walletToggleBtn.textContent = "Connect Wallet";
    updateFooterInfo();
    Swal.fire({
      title: "Disconnected",
      text: "Wallet disconnected successfully",
      icon: "info",
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 3000
    });
  }

  walletToggleBtn.addEventListener("click", function () {
    if (!isConnected) {
      showWalletOptions();
    } else {
      if (confirm("Do you want to disconnect your wallet?")) {
        disconnectWallet();
      }
    }
  });

  // ----------------------------
  // CUSTOM DROPDOWN FOR USER-GENERATED TOKENS
  // ----------------------------
  userInput.addEventListener("input", function () {
    const query = this.value.toLowerCase();
    userTokenDropdown.innerHTML = "";
    const filtered = userTokens.filter((token) =>
      token.toLowerCase().includes(query),
    );
    if (filtered.length === 0) {
      userTokenDropdown.style.display = "none";
      return;
    }
    filtered.forEach((token) => {
      const li = document.createElement("li");
      li.textContent = token;
      li.addEventListener("click", () => {
        userInput.value = token;
        userTokenDropdown.style.display = "none";
        showRoundSelectionModal(token, "UserGenerated");
      });
      userTokenDropdown.appendChild(li);
    });
    const rect = userInput.getBoundingClientRect();
    userTokenDropdown.style.position = "absolute";
    userTokenDropdown.style.top = rect.bottom + window.scrollY + "px";
    userTokenDropdown.style.left = rect.left + window.scrollX + "px";
    userTokenDropdown.style.width = rect.width + "px";
    userTokenDropdown.style.display = "block";
  });

  // Add click event to show filtered tokens when input is clicked
  userInput.addEventListener("click", function () {
    userTokenDropdown.innerHTML = "";

    // Get current input value for filtering
    const query = this.value.toLowerCase();

    // Filter tokens based on current input text
    const tokensToShow = query.length > 0
      ? userTokens.filter(token => token.toLowerCase().includes(query))
      : userTokens;

    // Only show dropdown if we have tokens to display
    if (tokensToShow.length === 0) {
      userTokenDropdown.style.display = "none";
      return;
    }

    // Populate the dropdown with filtered tokens
    tokensToShow.forEach((token) => {
      const li = document.createElement("li");
      li.textContent = token;
      li.addEventListener("click", () => {
        userInput.value = token;
        userTokenDropdown.style.display = "none";
        showRoundSelectionModal(token, "UserGenerated");
      });
      userTokenDropdown.appendChild(li);
    });

    const rect = userInput.getBoundingClientRect();
    userTokenDropdown.style.position = "absolute";
    userTokenDropdown.style.top = rect.bottom + window.scrollY + "px";
    userTokenDropdown.style.left = rect.left + window.scrollX + "px";
    userTokenDropdown.style.width = rect.width + "px";
    userTokenDropdown.style.display = "block";
  });

  // Add document click listener to hide dropdown when clicking outside
  document.addEventListener("click", function (e) {
    // If the click is outside both the input and the dropdown
    if (e.target !== userInput && !userTokenDropdown.contains(e.target)) {
      userTokenDropdown.style.display = "none";
    }
  });

  // ----------------------------
  // Datalist for Established Tokens (native)
  // ----------------------------
  function populateDatalists() {
    establishedDatalist.innerHTML = "";
    establishedTokens.sort().forEach((token) => {
      const option = document.createElement("option");
      option.value = token;
      establishedDatalist.appendChild(option);
    });
  }
  populateDatalists();

  establishedInput.addEventListener("change", function () {
    if (
      establishedTokens
        .map((t) => t.toLowerCase())
        .includes(this.value.trim().toLowerCase())
    ) {
      showRoundSelectionModal(this.value, "Established");
    }
  });

  // ----------------------------
  // ROUND SELECTION & ASSET PREVIEW (via Swal)
  // ----------------------------
  function showRoundSelectionModal(assetName, assetType) {
    let description =
      assetType === "Established"
        ? "This is a popular, established token with high liquidity."
        : "This user-generated asset is community-driven and unique.";
    Swal.fire({
      title: `${assetName} Preview`,
      html: `
        <p>${description}</p>
        <p>Select a Round Duration:</p>
        <div id="round-options">
          <button class="btn btn-secondary btn-sm round-btn" data-duration="30">30 minutes</button>
          <button class="btn btn-secondary btn-sm round-btn" data-duration="60">1 hour</button>
          <button class="btn btn-secondary btn-sm round-btn" data-duration="720">12 hours</button>
          <button class="btn btn-secondary btn-sm round-btn" data-duration="1440">1 day</button>
          <button class="btn btn-secondary btn-sm round-btn" data-duration="10080">1 week</button>
          <button class="btn btn-secondary btn-sm round-btn" data-duration="43200">1 month</button>
          <button class="btn btn-secondary btn-sm round-btn" data-duration="525600">1 year</button>
        </div>
      `,
      showConfirmButton: false,
      didOpen: () => {
        const buttons = Swal.getPopup().querySelectorAll(".round-btn");
        buttons.forEach((btn) => {
          btn.addEventListener("click", function () {
            const duration = parseInt(this.getAttribute("data-duration"));
            let initialPrice = assetType === "Established" ? 20000 : 50;
            currentAsset = {
              assetID: 1,
              assetName: assetName,
              assetType: assetType,
              interval: duration * 60,
              repeating: assetType === "Established",
              currentRoundID: 1,
              currentRoundData: {
                startTime: Math.floor(Date.now() / 1000),
                endTime:
                  Math.floor(Date.now() / 1000) +
                  Math.floor(duration * 60 * 0.95),
                initialPrice: initialPrice,
                ended: false,
                upPool: 0,
                downPool: 0,
                originalOraclePrice: initialPrice,
                currentOraclePrice: initialPrice,
              },
            };
            currentAsset.acquisitionDate = new Date().toLocaleString();
            Swal.close();
            renderAssetPreview();
          });
        });
      },
    });
  }

  // ----------------------------
  // RENDER ASSET PREVIEW
  // ----------------------------
  function renderAssetPreview() {
    const previewArea = document.getElementById("asset-preview-area");
    previewArea.innerHTML = "";
    if (!currentAsset) return;
    const remaining =
      currentAsset.currentRoundData.endTime - Math.floor(Date.now() / 1000);
    const { mins, secs } = formatCountdown(remaining);
    const previewHTML = `
      <div class="card my-3">
        <div class="card-body">
          <h5 class="card-title">Asset: ${currentAsset.assetName} (${currentAsset.assetType})</h5>
          <p>Round Duration: ${Math.floor(currentAsset.interval / 60)} minutes</p>
          <p>Time Remaining: <span id="asset-minutes">${mins}</span> : <span id="asset-seconds">${secs}</span></p>
          <p>Ticket Price: $<span id="ticket-price">5.00</span></p>
          <div class="d-flex flex-wrap gap-3 mt-3">
            <div class="text-center">
              <div>Predict Down</div>
              <button class="btn btn-danger btn-sm mt-2" id="predict-down-btn">Buy Ticket</button>
            </div>
            <div class="text-center">
              <div>Predict Up</div>
              <button class="btn btn-success btn-sm mt-2" id="predict-up-btn">Buy Ticket</button>
            </div>
          </div>
          <div class="gauge-container" id="asset-gauge">
            <div class="gauge">
              <div class="needle" id="asset-needle" style="transform: rotate(45deg);"></div>
            </div>
            <div class="gauge-label-down">
              <div id="asset-down-percent">50%</div>
              <div class="small-text">Predict Down</div>
            </div>
            <div class="gauge-label-up">
              <div id="asset-up-percent">50%</div>
              <div class="small-text">Predict Up</div>
            </div>
          </div>
        </div>
      </div>
    `;
    previewArea.innerHTML = previewHTML;
    document
      .getElementById("predict-up-btn")
      .addEventListener("click", function () {
        simulateBuyTicket(currentAsset.assetID, true);
      });
    document
      .getElementById("predict-down-btn")
      .addEventListener("click", function () {
        simulateBuyTicket(currentAsset.assetID, false);
      });
    startAssetPreviewCountdown();
    updateGauge();
  }

  // ----------------------------
  // ASSET PREVIEW COUNTDOWN & TICKET PRICE UPDATE
  // ----------------------------
  function startAssetPreviewCountdown() {
    if (assetPreviewIntervalID) clearInterval(assetPreviewIntervalID);
    assetPreviewIntervalID = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      let remaining = currentAsset.currentRoundData.endTime - now;
      if (remaining < 0) remaining = 0;
      const { mins, secs } = formatCountdown(remaining);
      document.getElementById("asset-minutes").textContent = mins;
      document.getElementById("asset-seconds").textContent = secs;
      const T = currentAsset.interval;
      const elapsed = now - currentAsset.currentRoundData.startTime;
      const cutoff = 0.95 * T;
      const effectiveElapsed = elapsed > cutoff ? cutoff : elapsed;
      const ticketPrice = 5 + 5 * (effectiveElapsed / cutoff);
      document.getElementById("ticket-price").textContent =
        ticketPrice.toFixed(2);
      if (remaining === 0) clearInterval(assetPreviewIntervalID);
    }, 1000);
  }

  // ----------------------------
  // TICKET PURCHASE SIMULATION
  // ----------------------------
  function simulateBuyTicket(assetID, predictUp) {
    if (!isConnected) {
      Swal.fire(
        "Not Connected",
        "Please connect your wallet first.",
        "warning",
      );
      return;
    }

    // Check if on correct network
    if (!isCorrectNetwork()) {
      Swal.fire({
        title: "Wrong Network",
        html: "You need to be on the <strong>Optimism</strong> network to buy prediction tickets.<br><br>Please switch your network and try again.",
        icon: "error"
      });
      return;
    }

    Swal.fire({
      title: "Buy Tickets",
      input: "number",
      inputLabel: "Number of tickets",
      inputPlaceholder: "Enter number of tickets",
      inputAttributes: { min: 1, step: 1 },
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || value < 1) return "Please enter at least 1 ticket!";
      },
    }).then((result) => {
      if (result.value) {
        const count = parseInt(result.value, 10);
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - currentAsset.currentRoundData.startTime;
        const T = currentAsset.interval;
        const cutoff = 0.95 * T;
        const effectiveElapsed = elapsed > cutoff ? cutoff : elapsed;
        const ticketPrice = 5 + 5 * (effectiveElapsed / cutoff);
        const totalCost = (ticketPrice * count).toFixed(2);
        Swal.fire({
          title: "Processing Transaction",
          html: '<p class="pending-dots"><span>.</span><span>.</span><span>.</span></p><p>Please confirm with your Wallet provider...</p>',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
        setTimeout(() => {
          if (predictUp) {
            currentAsset.currentRoundData.upPool += parseFloat(totalCost);
          } else {
            currentAsset.currentRoundData.downPool += parseFloat(totalCost);
          }
          Swal.fire(
            "Success",
            `Tickets purchased for $${totalCost}`,
            "success",
          );
          updateGauge();
          Swal.close();
        }, 3000);
      }
    });
  }

  function updateGauge() {
    const up = currentAsset.currentRoundData.upPool;
    const down = currentAsset.currentRoundData.downPool;
    const total = up + down;
    const upPercent = total > 0 ? Math.round((up / total) * 100) : 50;
    const downPercent = 100 - upPercent;
    document.getElementById("asset-up-percent").textContent = upPercent + "%";
    document.getElementById("asset-down-percent").textContent =
      downPercent + "%";
    const rotation = (upPercent - 50) * 1.8;
    document.getElementById("asset-needle").style.transform =
      `rotate(${0 + rotation}deg)`;
  }

  // ----------------------------
  // PORTFOLIO OVERLAY
  // ----------------------------
  portfolioBtn.addEventListener("click", showPortfolio);

  function showPortfolio() {
    if (!isConnected) {
      Swal.fire(
        "Not Connected",
        "Please connect your wallet to view your portfolio.",
        "warning"
      );
      return;
    }

    const portfolioOverlay = document.getElementById("portfolio-overlay");

    // Show portfolio regardless of network
    portfolioOverlay.classList.remove("hidden");

    // Get the network warning element (will create if it doesn't exist)
    let networkWarningBanner = document.getElementById("portfolio-network-warning");
    if (!networkWarningBanner) {
      networkWarningBanner = document.createElement("div");
      networkWarningBanner.id = "portfolio-network-warning";
      networkWarningBanner.style.backgroundColor = "#e06c75";
      networkWarningBanner.style.color = "#ffffff";
      networkWarningBanner.style.padding = "10px";
      networkWarningBanner.style.marginBottom = "15px";
      networkWarningBanner.style.borderRadius = "4px";
      networkWarningBanner.style.display = "none";

      // Insert at the top of the portfolio modal content
      const portfolioModal = document.querySelector(".portfolio-modal");
      portfolioModal.insertBefore(networkWarningBanner, portfolioModal.firstChild);
    }

    // Use the shared function to update the network banner
    updatePortfolioNetworkBanner();

    // Update portfolio data with current asset info
    document.getElementById("bitcoin-date").textContent =
      currentAsset && currentAsset.assetName === "Bitcoin"
        ? currentAsset.acquisitionDate
        : new Date().toLocaleString();
    document.getElementById("ethereum-date").textContent =
      new Date().toLocaleString();

    // Update balances via the shared function
    updatePortfolioBalances();

    // Add close button event listener
    document
      .getElementById("close-portfolio-btn")
      .addEventListener("click", function () {
        portfolioOverlay.classList.add("hidden");
      });
  }

  window.liquidateTeddy = function (bearName, price) {
    Swal.fire({
      title: "Liquidate Teddy Bear",
      input: "number",
      inputLabel: "Enter quantity (max 5)",
      inputValue: 5,
      inputAttributes: { min: 1, max: 5, step: 1 },
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || value < 1 || value > 5)
          return "Enter a quantity between 1 and 5";
      },
    }).then((result) => {
      if (result.value) {
        const qty = parseInt(result.value, 10);
        document.getElementById("portfolio-overlay").classList.add("hidden");
        Swal.fire({
          title: "Processing Liquidation",
          html: '<p class="pending-dots"><span>.</span><span>.</span><span>.</span></p><p>Please wait...</p>',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
        setTimeout(() => {
          Swal.fire(
            "Success",
            `${bearName} liquidated for $${price * qty}`,
            "success",
          );
          if (bearName === "Bitcoin Bear") {
            const countElem = document.getElementById("bitcoin-bear-count");
            countElem.textContent = Math.max(
              0,
              parseInt(countElem.textContent, 10) - qty,
            );
          } else {
            const countElem = document.getElementById("ethereum-bear-count");
            countElem.textContent = Math.max(
              0,
              parseInt(countElem.textContent, 10) - qty,
            );
          }
          Swal.close();
        }, 3000);
      }
    });
  };

  window.sendTeddy = function (bearName) {
    Swal.fire({
      title: "Send Teddy Bear",
      html:
        '<input type="text" id="recipient-address" class="swal2-input" placeholder="Recipient Address">' +
        '<input type="number" id="send-qty" class="swal2-input" placeholder="Quantity" value="1" min="1" max="5">',
      showCancelButton: true,
      preConfirm: () => {
        const address = document
          .getElementById("recipient-address")
          .value.trim();
        const qty = document.getElementById("send-qty").value;
        if (!address) {
          Swal.showValidationMessage("Please enter a recipient address");
        }
        return { address, qty };
      },
    }).then((result) => {
      if (result.value) {
        Swal.fire(
          "Success",
          `${result.value.qty} ${bearName}(s) sent to ${result.value.address}`,
          "success",
        );
      }
    });
  };

  // ----------------------------
  // HISTORY TABLE POPULATION
  // ----------------------------
  function populateHistory() {
    const historyTbody = document.getElementById("history-tbody");
    historyTbody.innerHTML = "";
    historyData.forEach((item) => {
      const row = document.createElement("tr");
      row.className = item.result.includes("Up") ? "bg-up" : "bg-down";
      row.innerHTML = `<td>${item.time}</td><td>${item.result}</td>`;
      historyTbody.appendChild(row);
    });
  }

  // ----------------------------
  // CREATE ASSET LIGHTBOX
  // ----------------------------
  addAssetBtn.addEventListener("click", showAddAssetModal);
 
   function showAddAssetModal() {
    if (!isConnected) {
      Swal.fire(
        "Not Connected",
        "Please connect your wallet first to create assets.",
        "warning"
      );
      return;
    }
    
    // Check if on correct network
    if (!isCorrectNetwork()) {
      Swal.fire({
        title: "Wrong Network",
        html: "You need to be on the <strong>Optimism</strong> network to create assets.<br><br>Please switch your network and try again.",
        icon: "error"
      });
      return;
    }
  // const createAssetLightbox = document.getElementById("create-asset-lightbox");
  // const closeAssetLightboxBtn = document.getElementById("close-asset-lightbox");
  // const cancelAssetCreationBtn = document.getElementById("cancel-asset-creation");
  // const createAssetForm = document.getElementById("create-asset-form");

  // // Open lightbox when Create Asset button is clicked
  // createAssetBtn.addEventListener("click", function() {
  //   if (!isConnected) {
  //     Swal.fire(
  //       "Not Connected",
  //       "Please connect your wallet first to create assets.",
  //       "warning"
  //     );
  //     return;
  //   }

  //   // Check if on correct network
  //   if (!isCorrectNetwork()) {
  //     Swal.fire({
  //       title: "Wrong Network",
  //       html: "You need to be on the <strong>Optimism</strong> network to create assets.<br><br>Please switch your network and try again.",
  //       icon: "error"
  //     });
  //     return;
  //   }

  //   createAssetLightbox.classList.remove("hidden");
  //   document.body.style.overflow = "hidden"; // Prevent scrolling behind lightbox
  // });

  // // Close lightbox functions
  // function closeAssetLightbox() {
  //   createAssetLightbox.classList.add("hidden");
  //   document.body.style.overflow = ""; // Re-enable scrolling
  //   createAssetForm.reset(); // Reset form fields
  // }

  // closeAssetLightboxBtn.addEventListener("click", closeAssetLightbox);
  // cancelAssetCreationBtn.addEventListener("click", closeAssetLightbox);

  // // Handle form submission
  // createAssetForm.addEventListener("submit", function(e) {
  //   e.preventDefault();

  //   // Get form values
  //   const assetName = document.getElementById("asset-name").value.trim();
  //   const tokenAddress = document.getElementById("token-address").value.trim();
  //   const communicationLink = document.getElementById("communication-link").value.trim();
  //   const priceOracleUrl = document.getElementById("price-oracle-url").value.trim();
  //   const roundInterval = document.getElementById("round-interval").value;
  //   const regulatoryDisclosure = document.getElementById("regulatory-disclosure").value.trim();

  //   // Validate URL fields
  //   const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;

  //   let hasErrors = false;
  //   let errorMessage = "";

  //   if (!urlPattern.test(communicationLink)) {
  //     hasErrors = true;
  //     errorMessage += "• Communication Link must be a valid URL\n";
  //   }

  //   if (!urlPattern.test(priceOracleUrl)) {
  //     hasErrors = true;
  //     errorMessage += "• Price Oracle URL must be a valid URL\n";
  //   }

  //   if (hasErrors) {
  //     Swal.fire({
  //       title: "Validation Error",
  //       html: `<div style="text-align: left; color: #e06c75;">${errorMessage.replace(/\n/g, '<br>')}</div>`,
  //       icon: "error"
  //     });
  //     return;
  //   }

  //   // Create asset object
  //   const newAsset = {
  //     id: createdAssets.length + 1,
  //     name: assetName,
  //     tokenAddress: tokenAddress,
  //     communicationLink: communicationLink,
  //     priceOracleUrl: priceOracleUrl,
  //     roundInterval: parseInt(roundInterval),
  //     regulatoryDisclosure: regulatoryDisclosure,
  //     dateCreated: new Date().toISOString(),
  //     createdBy: selectedAccount
  //   };

  //   // Add to created assets array
  //   createdAssets.push(newAsset);

  //   // Add to user tokens for display in dropdown
  //   if (!userTokens.includes(assetName)) {
  //     userTokens.push(assetName);
  //   }

  //   // Show success message
  Swal.fire({
    title: "Add Asset",
    html: `
        <p>Is this an Existing Token or a New Token?</p>
         <label><input type="radio" name="asset-add-kind" value="existing" checked> Existing Token</label>
         <label><input type="radio" name="asset-add-kind" value="new"> New Token</label>
      `,
    showCancelButton: true,
    confirmButtonText: "Next",
    preConfirm: () => {
      const kind = Swal.getPopup().querySelector(
        'input[name="asset-add-kind"]:checked',
      ).value;
      return kind;
    },
  }).then((result) => {
    if (result.value) {
      const kind = result.value;
      let tokenAddressField = "";
      if (kind === "existing") {
        tokenAddressField = `<tr>
               <td><label for="asset-address">Token Address:</label></td>
               <td><input type="text" id="asset-address" class="swal2-input" placeholder="Token Address"></td>
             </tr>`;
      }
      Swal.fire({
        title: "Asset Details",
        html: `
             <table style="width:100%; text-align:left; font-size:0.8rem;">
               <tr>
                 <td><label for="asset-name">Asset Name:</label></td>
                 <td><input type="text" id="asset-name" class="swal2-input" placeholder="Asset Name"></td>
               </tr>
               ${tokenAddressField}
               <tr>
                 <td><label for="asset-symbol">Symbol:</label></td>
                 <td><input type="text" id="asset-symbol" class="swal2-input" placeholder="e.g. BTC"></td>
               </tr>
               <tr>
                 <td><label for="asset-decimals">Decimals:</label></td>
                 <td><input type="number" id="asset-decimals" class="swal2-input" placeholder="18 (recommended)"></td>
               </tr>
               <tr>
                 <td><label for="asset-supply">Total Supply:</label></td>
                 <td><input type="number" id="asset-supply" class="swal2-input" placeholder="Total Supply"></td>
               </tr>
               <tr>
                 <td><label for="asset-description">Description:</label></td>
                 <td><textarea id="asset-description" class="swal2-textarea" placeholder="Brief asset description"></textarea></td>
               </tr>
               <tr>
                 <td><label for="asset-category">Category:</label></td>
                 <td>
                   <select id="asset-category" class="swal2-input">
                     <option value="Real Estate Token">Real Estate Token</option>
                     <option value="Security Token">Security Token</option>
                     <option value="Gaming Token">Gaming Token</option>
                     <option value="Digital Asset">Normal Digital Asset</option>
                     <option value="Other">Other</option>
                   </select>
                 </td>
               </tr>
               <tr>
                 <td><label for="discord-url">Discord Invite URL:</label></td>
                 <td><input type="url" id="discord-url" class="swal2-input" placeholder="Discord Invite URL"></td>
               </tr>
               <tr>
                 <td><label for="other-comm-url">Other Communication URL:</label></td>
                 <td><input type="url" id="other-comm-url" class="swal2-input" placeholder="Other Communication URL"></td>
               </tr>
               <tr>
                 <td><label for="entity-name">Entity Name:</label></td>
                 <td><input type="text" id="entity-name" class="swal2-input" placeholder="Requested Entity Name"></td>
               </tr>
               <tr>
                 <td><label for="entity-address">Entity Address:</label></td>
                 <td><input type="text" id="entity-address" class="swal2-input" placeholder="Entity Physical Address"></td>
               </tr>
               <tr>
                 <td><label for="contact-phone">Contact Phone:</label></td>
                 <td><input type="tel" id="contact-phone" class="swal2-input" placeholder="Contact Phone"></td>
               </tr>
               <tr>
                 <td><label for="contact-email">Contact Email:</label></td>
                 <td><input type="email" id="contact-email" class="swal2-input" placeholder="Contact Email"></td>
               </tr>
               <tr>
                 <td><label for="regulatory-link">Regulatory Info Link (optional):</label></td>
                 <td><input type="url" id="regulatory-link" class="swal2-input" placeholder="Regulatory Information URL"></td>
               </tr>
               <tr>
                 <td><label for="price-oracle">Price Oracle URL:</label></td>
                 <td><input type="url" id="price-oracle" class="swal2-input" placeholder="Oracle URL"></td>
               </tr>
               <tr>
                 <td><label for="asset-interval">Default Round Interval (minutes):</label></td>
                 <td><input type="number" id="asset-interval" class="swal2-input" placeholder="e.g. 30"></td>
               </tr>
             </table>
           `,
        showCancelButton: true,
        confirmButtonText: "Add Asset",
        preConfirm: () => {
          const name = document.getElementById("asset-name").value.trim();
          const symbol = document.getElementById("asset-symbol").value.trim();
          const decimals = document
            .getElementById("asset-decimals")
            .value.trim();
          const supply = document.getElementById("asset-supply").value.trim();
          const description = document
            .getElementById("asset-description")
            .value.trim();
          const category = document.getElementById("asset-category").value;
          const discord = document.getElementById("discord-url").value.trim();
          const otherComm = document
            .getElementById("other-comm-url")
            .value.trim();
          const entityName = document
            .getElementById("entity-name")
            .value.trim();
          const entityAddress = document
            .getElementById("entity-address")
            .value.trim();
          const contactPhone = document
            .getElementById("contact-phone")
            .value.trim();
          const contactEmail = document
            .getElementById("contact-email")
            .value.trim();
          const regulatoryLink = document
            .getElementById("regulatory-link")
            .value.trim();
          const oracle = document.getElementById("price-oracle").value.trim();
          const interval = document
            .getElementById("asset-interval")
            .value.trim();
          let tokenAddress = "";
          if (kind === "existing") {
            tokenAddress = document
              .getElementById("asset-address")
              .value.trim();
            if (!tokenAddress) {
              Swal.showValidationMessage("Please enter the Token Address");
              return false;
            }
          }
          if (
            !name ||
            !symbol ||
            !decimals ||
            !supply ||
            !description ||
            !category ||
            !discord ||
            !otherComm ||
            !entityName ||
            !entityAddress ||
            !contactPhone ||
            !contactEmail ||
            !oracle ||
            !interval
          ) {
            Swal.showValidationMessage("Please fill out all required fields");
            return false;
          }
          return {
            name,
            symbol,
            decimals,
            supply,
            description,
            category,
            discord,
            otherComm,
            entityName,
            entityAddress,
            contactPhone,
            contactEmail,
            regulatoryLink,
            oracle,
            interval,
            tokenAddress,
            kind,
          };
        },
      }).then((result) => {
        if (result.value) {
          Swal.fire({
            title: "Processing Asset Addition",
            html: '<p class="pending-dots"><span>.</span><span>.</span><span>.</span></p>',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });
          setTimeout(() => {
            const assetLink =
              "https://ampable.akashnetwork.io/token/0x" +
              Math.floor(Math.random() * 1e16).toString(16);
            Swal.fire(
              "Success",
              `Asset added! View at: <a href="${assetLink}" target="_blank">${assetLink}</a>`,
              "success",
            );
            userTokens.push(result.value.name);
            // Refresh the custom dropdown by clearing it.
            userTokenDropdown.innerHTML = "";
          }, 3000);
        }
      });
    }
    // icon: "success"
  });
}

  //   // Close lightbox and reset form
  //   closeAssetLightbox();

  //   // Log to console for debugging
  //   console.log("New asset created:", newAsset);
  //   console.log("Current created assets:", createdAssets);
  // });

  // ----------------------------
  // INITIALIZATION
  // ----------------------------
  function initDemo() {
    // Stage 1: Basic UI setup
    updateLoadingProgress(25, "Setting up interface...");
    updateFooterInfo();

    // Stage 2: Load UI components progressively
    setTimeout(() => {
      updateLoadingProgress(50, "Loading assets...");

      // Setup tokens and search
      populateDatalists();

      // Initialize asset data
      currentAsset = {
        assetID: 1,
        assetName: "Bitcoin",
        assetType: "Established",
        interval: 1800,
        repeating: true,
        currentRoundID: 1,
        currentRoundData: {
          startTime: Math.floor(Date.now() / 1000),
          endTime: Math.floor(Date.now() / 1000) + Math.floor(0.95 * 1800),
          initialPrice: 20000,
          ended: false,
          upPool: 0,
          downPool: 0,
          originalOraclePrice: 20000,
          currentOraclePrice: 20000,
        },
      };
      currentAsset.acquisitionDate = new Date().toLocaleString();

      // Stage 3: Render UI components
      setTimeout(() => {
        updateLoadingProgress(75, "Rendering components...");
        renderAssetPreview();
        populateHistory();

        // Stage 4: Setup event listeners
        setTimeout(() => {
          updateLoadingProgress(100, "Finalizing setup...");

          // Set up Network Switch Lightbox listeners
          setupNetworkListeners();

          // Setup "How This Works" overlay
          howItWorksText.addEventListener("click", () => {
            howOverlay.classList.remove("hidden");
          });
          document.getElementById("close-how-btn").addEventListener("click", () => {
            howOverlay.classList.add("hidden");
          });

          // Remove loading overlay with slight delay for smooth transition
          setTimeout(() => {
            document.body.removeChild(loadingOverlay);
          }, 300);
        }, 100);
      }, 100);
    }, 100);
  }

  // Setup network listeners separately
  function setupNetworkListeners() {
    const switchNetworkBtn = document.getElementById("switch-network-btn");
    const closeNetworkWarningBtn = document.getElementById("close-network-warning");

    if (switchNetworkBtn) {
      switchNetworkBtn.addEventListener("click", switchToOptimism);
    }

    if (closeNetworkWarningBtn) {
      closeNetworkWarningBtn.addEventListener("click", function () {
        const networkSwitchLightbox = document.getElementById("network-switch-lightbox");
        networkSwitchLightbox.classList.add("hidden");
        document.body.style.overflow = "";

        Swal.fire({
          title: "Limited Access",
          text: "Some features will be disabled until you switch to Optimism network",
          icon: "warning",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 4000
        });
      });
    }
  }

  initDemo();

  // Network checking function - make it more efficient
  function checkNetwork() {
    // If not connected yet, don't show the network warning
    if (!isConnected || !chainId) {
      return;
    }

    const networkSwitchLightbox = document.getElementById("network-switch-lightbox");
    const currentNetworkSpan = document.getElementById("current-network-name");

    if (chainId !== REQUIRED_NETWORK.chainId) {
      // User is on the wrong network
      let networkName = "Unknown Network";

      // Get the network name
      const chainIdDec = parseInt(chainId, 16);
      switch (chainIdDec) {
        case 1:
          networkName = "Ethereum Mainnet";
          break;
        case 56:
          networkName = "Binance Smart Chain";
          break;
        case 137:
          networkName = "Polygon";
          break;
        default:
          networkName = `Chain ID: ${chainIdDec}`;
      }

      // Update the network name in the lightbox
      if (currentNetworkSpan) {
        currentNetworkSpan.textContent = networkName;
      }

      // Show the network switch lightbox
      // Delay showing the modal to avoid blocking initial page load
      setTimeout(() => {
        if (networkSwitchLightbox) {
          networkSwitchLightbox.classList.remove("hidden");
          document.body.style.overflow = "hidden"; // Prevent scrolling
        }
      }, 500);
    }
  }

  // Function to switch networks via MetaMask
  async function switchToOptimism() {
    try {
      // First try to switch to the Optimism network
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: REQUIRED_NETWORK.chainId }],
      });

      // If successful, close the warning and update UI
      const networkSwitchLightbox = document.getElementById("network-switch-lightbox");
      if (networkSwitchLightbox) {
        networkSwitchLightbox.classList.add("hidden");
      }
      document.body.style.overflow = "";

      // Update portfolio warning banner if portfolio is open
      updatePortfolioNetworkBanner();

      // Only reconnect if the user hasn't explicitly disconnected
      if (!isConnected && !userDisconnected) {
        // If connection was lost during network switch but user didn't disconnect
        connectMetaMask();
      } else if (isConnected) {
        // Update the UI to show the correct network
        updateFooterInfo();

        Swal.fire({
          title: "Network Switched!",
          text: "Successfully switched to Optimism network",
          icon: "success",
          toast: true,
          position: "top-end",
          showConfirmButton: false,
          timer: 3000
        });
      }

    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        try {
          // Add the Optimism network to MetaMask
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: REQUIRED_NETWORK.chainId,
                chainName: REQUIRED_NETWORK.chainName,
                nativeCurrency: REQUIRED_NETWORK.nativeCurrency,
                rpcUrls: REQUIRED_NETWORK.rpcUrls,
                blockExplorerUrls: REQUIRED_NETWORK.blockExplorerUrls
              },
            ],
          });

          // If successful, close the warning and update UI
          const networkSwitchLightbox = document.getElementById("network-switch-lightbox");
          if (networkSwitchLightbox) {
            networkSwitchLightbox.classList.add("hidden");
          }
          document.body.style.overflow = "";

          // Update portfolio warning banner if portfolio is open
          updatePortfolioNetworkBanner();

          // Only reconnect if the user hasn't explicitly disconnected
          if (!isConnected && !userDisconnected) {
            // If connection was lost during network switch but user didn't disconnect
            connectMetaMask();
          } else if (isConnected) {
            // Update the UI to show the correct network
            updateFooterInfo();

            Swal.fire({
              title: "Network Added & Switched!",
              text: "Successfully switched to Optimism network",
              icon: "success",
              toast: true,
              position: "top-end",
              showConfirmButton: false,
              timer: 3000
            });
          }

        } catch (addError) {
          console.error("Error adding Optimism network:", addError);
          Swal.fire({
            title: "Network Error",
            text: "Failed to add Optimism network to MetaMask",
            icon: "error"
          });
        }
      } else {
        console.error("Error switching network:", switchError);
        Swal.fire({
          title: "Network Error",
          text: "Failed to switch to Optimism network",
          icon: "error"
        });

        // Only attempt reconnection if not explicitly disconnected
        if (provider && !isConnected && !userDisconnected) {
          // Give MetaMask a moment to recover from the switch operation
          setTimeout(() => {
            connectMetaMask();
          }, 1000);
        }
      }
    }
  }

  // Function to check if user is on the correct network
  function isCorrectNetwork() {
    return chainId === REQUIRED_NETWORK.chainId;
  }

  // Function to update the portfolio network banner based on current network
  function updatePortfolioNetworkBanner() {
    // Only proceed if the portfolio is currently open
    const portfolioOverlay = document.getElementById("portfolio-overlay");
    if (!portfolioOverlay || portfolioOverlay.classList.contains("hidden")) {
      return;
    }

    // Get the network warning element
    let networkWarningBanner = document.getElementById("portfolio-network-warning");
    if (!networkWarningBanner) {
      return;
    }

    // Check if on correct network and show/hide warning accordingly
    if (!isCorrectNetwork()) {
      // Show warning if not on Optimism
      networkWarningBanner.style.display = "block";

      // Get current network name for better user feedback
      let currentNetworkName = "another network";
      if (chainId) {
        const chainIdDec = parseInt(chainId, 16);
        switch (chainIdDec) {
          case 1:
            currentNetworkName = "Ethereum Mainnet";
            break;
          case 56:
            currentNetworkName = "Binance Smart Chain";
            break;
          case 137:
            currentNetworkName = "Polygon";
            break;
          default:
            currentNetworkName = `Chain ID ${chainIdDec}`;
        }
      }

      // Update HTML content with network-specific message
      networkWarningBanner.innerHTML = `
        <strong>Wrong Network:</strong> You're viewing portfolio data from ${currentNetworkName}. 
        <a href="#" id="portfolio-switch-network" style="color: #ffffff; text-decoration: underline;">Switch to Optimism</a> 
        for full access to features.
      `;

      // Add click handler for the switch network link
      setTimeout(() => {
        const switchLink = document.getElementById("portfolio-switch-network");
        if (switchLink) {
          switchLink.addEventListener("click", function (e) {
            e.preventDefault();
            switchToOptimism();
          });
        }
      }, 0);

      // Also update balances when network changes
      updatePortfolioBalances();
    } else {
      // Hide warning if on Optimism
      networkWarningBanner.style.display = "none";

      // Update balances for Optimism
      updatePortfolioBalances();
    }
  }

  // Function to update portfolio balances based on current network
  async function updatePortfolioBalances() {
    const ethBalanceSpan = document.getElementById("eth-balance");
    const usdcBalanceSpan = document.getElementById("usdc-balance");

    if (!ethBalanceSpan || !usdcBalanceSpan || !isConnected || !web3) {
      return;
    }

    // Show loading state
    ethBalanceSpan.innerHTML = '<span class="loading-dots">Loading<span>.</span><span>.</span><span>.</span></span>';
    usdcBalanceSpan.innerHTML = '<span class="loading-dots">Loading<span>.</span><span>.</span><span>.</span></span>';

    try {
      // Get ETH balance
      const weiBalance = await web3.eth.getBalance(selectedAccount);
      const ethBalance = web3.utils.fromWei(weiBalance, 'ether');
      const formattedEthBalance = parseFloat(ethBalance).toFixed(4);
      ethBalanceSpan.textContent = formattedEthBalance;

      // Get USDC balance if contract exists on this network
      const chainIdHex = chainId || "0x1"; // Default to Ethereum if not set
      const usdcContractAddress = USDC_CONTRACTS[chainIdHex];

      if (usdcContractAddress) {
        try {
          const usdcContract = new web3.eth.Contract(USDC_ABI, usdcContractAddress);
          const usdcDecimals = await usdcContract.methods.decimals().call();
          const usdcRawBalance = await usdcContract.methods.balanceOf(selectedAccount).call();
          const usdcBalance = usdcRawBalance / Math.pow(10, usdcDecimals);
          const formattedUsdcBalance = parseFloat(usdcBalance).toFixed(2);
          usdcBalanceSpan.textContent = `$${formattedUsdcBalance}`;
        } catch (error) {
          console.error("Error fetching USDC balance:", error);
          usdcBalanceSpan.textContent = "$0.00";
        }
      } else {
        // No USDC on this network or unknown network
        usdcBalanceSpan.textContent = "Not available on this network";
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
      ethBalanceSpan.textContent = "Error";
      usdcBalanceSpan.textContent = "Error";
    }
  }

  // Add event listener to refresh portfolio data when it's open
  document.getElementById("refresh-portfolio-btn").addEventListener("click", function () {
    if (isConnected) {
      updatePortfolioBalances();
    }
  });
});
