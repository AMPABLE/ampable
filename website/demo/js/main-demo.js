// MAIN-DEMO.JS – Plain JavaScript Simulation

document.addEventListener("DOMContentLoaded", function () {
  // ----------------------------
  // GLOBAL STATE
  // ----------------------------
  let isConnected = false;
  let selectedAccount = null;
  let currentAsset = null; // currently previewed asset
  let assetPreviewIntervalID = null; // for countdown

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
      footerInfo.innerHTML = `
        <span><span class="status-indicator status-connected"></span> ${shortAddr} | Disconnect</span>
        <span><strong>Contract:</strong> 0xb8D1...b84b5</span>
        <span><strong>Network:</strong> Optimism</span>
      `;
    }
  }

  // ----------------------------
  // WALLET CONNECTION FLOW
  // ----------------------------
  function showWalletOptions() {
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
              connectWalletPending("MetaMask");
            }, 1000);
          });
        document
          .getElementById("walletconnect-option")
          .addEventListener("click", () => {
            Swal.close();
            setTimeout(() => {
              connectWalletPending("WalletConnect");
            }, 1000);
          });
      },
    });
  }

  function connectWalletPending(method) {
    Swal.fire({
      title: `Connecting via ${method}`,
      html: '<p class="pending-dots"><span>.</span><span>.</span><span>.</span></p><p>Please confirm with your Wallet provider...</p>',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
    setTimeout(() => {
      isConnected = true;
      selectedAccount = "0x32ABCDEF6789";
      walletToggleBtn.textContent = "Disconnect Wallet";
      updateFooterInfo();
      Swal.close();
    }, 3000);
  }

  walletToggleBtn.addEventListener("click", function () {
    if (!isConnected) {
      showWalletOptions();
    } else {
      if (confirm("Do you want to disconnect your wallet?")) {
        isConnected = false;
        selectedAccount = null;
        walletToggleBtn.textContent = "Connect Wallet";
        updateFooterInfo();
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
      `rotate(${45 + rotation}deg)`;
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
        "warning",
      );
      return;
    }
    const portfolioOverlay = document.getElementById("portfolio-overlay");
    portfolioOverlay.classList.remove("hidden");
    document.getElementById("bitcoin-date").textContent =
      currentAsset && currentAsset.assetName === "Bitcoin"
        ? currentAsset.acquisitionDate
        : new Date().toLocaleString();
    document.getElementById("ethereum-date").textContent =
      new Date().toLocaleString();
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
  // ADD ASSET FLOW (Two-Step Modal)
  // ----------------------------
  addAssetBtn.addEventListener("click", showAddAssetModal);

  function showAddAssetModal() {
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
      `rotate(${45 + rotation}deg)`;
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
        "warning",
      );
      return;
    }
    const portfolioOverlay = document.getElementById("portfolio-overlay");
    portfolioOverlay.classList.remove("hidden");
    document.getElementById("bitcoin-date").textContent =
      currentAsset && currentAsset.assetName === "Bitcoin"
        ? currentAsset.acquisitionDate
        : new Date().toLocaleString();
    document.getElementById("ethereum-date").textContent =
      new Date().toLocaleString();
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
  // INITIALIZATION
  // ----------------------------
  function initDemo() {
    updateFooterInfo();
    // Default asset preview: Bitcoin is pre-selected.
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
    renderAssetPreview();
    populateHistory();
  }

  initDemo();

  // ----------------------------
  // "How This Works" Overlay Handling
  // ----------------------------
  howItWorksText.addEventListener("click", () => {
    howOverlay.classList.remove("hidden");
  });
  document.getElementById("close-how-btn").addEventListener("click", () => {
    howOverlay.classList.add("hidden");
  });
});
