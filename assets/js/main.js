document.addEventListener("DOMContentLoaded", function () {
  // Show loading indicator
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "loading-indicator";
  loadingIndicator.innerHTML =
    '<div class="spinner"></div><p>Loading Cognitive Bias Codex...</p>';
  document.getElementById("container").appendChild(loadingIndicator);

  // Check URL parameters for language
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get("lang") || "en"; // Default to English

  // Set document language
  document.documentElement.lang = langParam;

  // Load both the SVG and biases content in parallel
  Promise.all([
    fetch(`assets/images/cognitive_bias_codex_${langParam}.svg`)
      .then((response) => {
        if (!response.ok) {
          // Fallback to English
          document.documentElement.lang = "en";
          return fetch("assets/images/cognitive_bias_codex_en.svg");
        }
        return response;
      })
      .then((response) => response.text()),
    loadBiasesContent(),
  ])
    .then(([svgContent, biasesContent]) => {
      // Remove loading indicator
      document.getElementById("container").removeChild(loadingIndicator);

      // Insert SVG content
      document.getElementById("svg-container").innerHTML = svgContent;

      // Initialize all components with the biases content
      initializeTooltips(biasesContent);
      initializeLanguageSelector();
      initializeInfoPanel();
      initializePanZoom();

      if (isMobileDevice()) {
        initializeMobileView();
      }
    })
    .catch((error) => {
      console.error("Error loading resources:", error);
      loadingIndicator.innerHTML = `<div class="error">Error loading content: ${error.message}</div><p>Please try refreshing the page.</p>`;
    });
});

// Handle back/forward button navigation
window.addEventListener("popstate", function (event) {
  if (event.state && event.state.language) {
    const language = event.state.language;
    document.getElementById("language-selector").value = language;
    changeLanguage(language);
  } else {
    // If no state, check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get("lang");
    if (langParam && ["en", "pt", "ca", "eu", "fr", "uk"].includes(langParam)) {
      document.getElementById("language-selector").value = langParam;
      changeLanguage(langParam);
    }
  }
});

// Function to check if device is mobile
function isMobileDevice() {
  return (
    window.innerWidth <= 768 ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

// Function to initialize tooltips for biases
function initializeTooltips(biasesContent) {
  // Exit this function if we are not in English mode
  if (document.documentElement.lang !== "en") {
    return;
  }

  // Check if we're on mobile or desktop
  const mobile = isMobileDevice();

  // Get all bias elements
  const biasElements = document.querySelectorAll("svg a");
  if (biasElements.length === 0) {
    console.warn("No bias elements found in SVG");
    return;
  }

  // Create tooltip element to be reused
  const tooltip = document.createElement("div");
  tooltip.className = "custom-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.innerHTML = '<div class="tooltip-arrow" data-popper-arrow></div>';
  document.body.appendChild(tooltip);

  // Variables to track state
  let currentPopperInstance = null;
  let currentElement = null;
  let hideTimeoutId = null;
  let isTooltipLocked = false;

  // Clean up function to ensure proper state reset
  function cleanupPreviousTooltip() {
    // Clear any pending hide timeouts
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }

    // Remove highlight from previous element
    if (currentElement && currentElement !== this) {
      currentElement.classList.remove("highlighted");
    }

    // Destroy previous popper instance
    if (currentPopperInstance) {
      currentPopperInstance.destroy();
      currentPopperInstance = null;
    }
  }

  biasElements.forEach((element) => {
    // Get the bias name (using only English text)
    let biasName = "";
    const textElements = element.querySelectorAll("text");
    for (const textElement of textElements) {
      if (!textElement.hasAttribute("systemLanguage")) {
        biasName = textElement.textContent.trim();
        break;
      }
    }

    if (!biasName) return;

    const wikipediaUrl = element.getAttribute("xlink:href");
    const biasData = findBiasContent(biasesContent, biasName);
    const biasContent = biasData
      ? biasData.content
      : `<p>No detailed content available for ${biasName}.</p>`;

    if (mobile) {
      // For mobile: Use modal
      element.addEventListener("click", function (event) {
        event.preventDefault();
        showModal(biasName, biasContent, wikipediaUrl);
      });
    } else {
      // For desktop: Use tooltip
      element.addEventListener("mouseenter", function () {
        // Clean up any previous tooltip state
        cleanupPreviousTooltip();

        // Highlight the current element
        element.classList.add("highlighted");
        currentElement = element;

        // Update tooltip content
        tooltip.innerHTML = `
            <div class="tooltip-arrow" data-popper-arrow></div>
            <div class="tooltip-content">
              <h3>${biasName}</h3>
              ${biasContent}
              <a href="${wikipediaUrl}" target="_blank" class="wiki-link">Read more on Wikipedia</a>
            </div>
          `;

        // Show the tooltip
        tooltip.style.display = "block";

        // Create new popper instance
        currentPopperInstance = Popper.createPopper(element, tooltip, {
          placement: "auto",
          modifiers: [
            {
              name: "offset",
              options: { offset: [0, 40] },
            },
            {
              name: "preventOverflow",
              options: {
                boundary: document.querySelector("#svg-container"),
              },
            },
          ],
        });
      });

      element.addEventListener("mouseleave", function () {
        // Don't hide if tooltip is locked
        if (isTooltipLocked) return;

        // Set a timeout to hide the tooltip
        hideTimeoutId = setTimeout(() => {
          // Only hide if tooltip is not being hovered
          if (!tooltip.matches(":hover")) {
            tooltip.style.display = "none";
            element.classList.remove("highlighted");
            currentElement = null;

            if (currentPopperInstance) {
              currentPopperInstance.destroy();
              currentPopperInstance = null;
            }
          }
        }, 50); // Short timeout to reduce chance of race conditions
      });
    }
  });

  // Handle mouse entering the tooltip itself
  tooltip.addEventListener("mouseenter", function () {
    // Lock the tooltip while hovering over it
    isTooltipLocked = true;

    // Clear any pending hide timeout
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }
  });

  // Handle mouse leaving the tooltip
  tooltip.addEventListener("mouseleave", function () {
    // Unlock the tooltip
    isTooltipLocked = false;

    // Hide the tooltip after a short delay
    hideTimeoutId = setTimeout(() => {
      tooltip.style.display = "none";

      if (currentElement) {
        currentElement.classList.remove("highlighted");
        currentElement = null;
      }

      if (currentPopperInstance) {
        currentPopperInstance.destroy();
        currentPopperInstance = null;
      }
    }, 50);
  });
}

// Helper function to find bias content with fuzzy matching
function findBiasContent(biasesContent, biasName) {
  const simpleName = biasName.toLowerCase().replace(/\s+/g, "-");

  // Try exact match first
  if (biasesContent[simpleName]) {
    return biasesContent[simpleName];
  }

  // Try looser matching if exact match fails
  for (const key in biasesContent) {
    if (key.includes(simpleName) || simpleName.includes(key)) {
      return biasesContent[key];
    }
  }

  return null;
}

// Function to show modal on mobile
function showModal(title, content, wikipediaUrl) {
  // Remove any existing modals first
  const existingModals = document.querySelectorAll(".modal");
  existingModals.forEach((modal) => {
    document.body.removeChild(modal);
  });

  // Create modal element
  const modal = document.createElement("div");
  modal.className = "modal";

  modal.innerHTML = `
      <div class="modal-content">
        <span class="close-button">&times;</span>
        <h2>${title}</h2>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">
          <a href="${wikipediaUrl}" target="_blank" class="wiki-button">Read more on Wikipedia</a>
        </div>
      </div>
    `;

  // Add modal to document
  document.body.appendChild(modal);

  // Show modal with a slight delay to allow for animation
  setTimeout(() => {
    modal.classList.add("show");
  }, 10);

  // Close button handler
  const closeButton = modal.querySelector(".close-button");
  const closeModal = function () {
    modal.classList.remove("show");
    setTimeout(() => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
    }, 300);
  };

  closeButton.addEventListener("click", closeModal);

  // Close when clicking outside modal
  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });
}

// Completely rewritten language selector function
function initializeLanguageSelector() {
  const languageSelector = document.getElementById("language-selector");
  if (!languageSelector) return;

  // Check URL parameters for language on page load
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get("lang");

  // If language parameter exists in URL, use it
  if (langParam && ["en", "pt", "ca", "eu", "fr", "uk"].includes(langParam)) {
    languageSelector.value = langParam;
    changeLanguage(langParam);
  }

  // Handle language selection change
  languageSelector.addEventListener("change", function () {
    const selectedLanguage = this.value;

    // Update URL with the new language parameter
    const newUrl = updateUrlParameter("lang", selectedLanguage);
    history.pushState({ language: selectedLanguage }, "", newUrl);

    // Change the language
    changeLanguage(selectedLanguage);
  });
}

// Helper function to update URL parameters
function updateUrlParameter(param, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(param, value);
  return url.toString();
}

// Function to change language
function changeLanguage(language) {
  const svgContainer = document.getElementById("svg-container");
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "loading-indicator";
  loadingIndicator.innerHTML =
    '<div class="spinner"></div><p>Loading translation...</p>';

  // Show loading indicator
  svgContainer.innerHTML = "";
  svgContainer.appendChild(loadingIndicator);

  // Fetch the SVG for the selected language
  fetch(`assets/images/cognitive_bias_codex_${language}.svg`)
    .then((response) => {
      if (!response.ok) {
        // Fallback to English if the language version doesn't exist
        return fetch("assets/images/cognitive_bias_codex_en.svg");
      }
      return response;
    })
    .then((response) => response.text())
    .then((svgContent) => {
      // Remove loading indicator
      svgContainer.removeChild(loadingIndicator);

      // Insert new SVG content
      svgContainer.innerHTML = svgContent;

      // Update document language attribute
      document.documentElement.lang = language;

      // Reinitialize tooltips and panzoom
      requestAnimationFrame(() => {
        loadBiasesContent().then((biasesContent) => {
          initializeTooltips(biasesContent);
        });
        initializePanZoom();
      });
    })
    .catch((error) => {
      console.error("Error loading SVG for language:", error);
      svgContainer.innerHTML = `<div class="error">Error loading translation. Refreshing the page may help.</div>`;
    });
}

// Function to load SVG for specific language
function loadSvgForLanguage(language) {
  const svgContainer = document.getElementById("svg-container");
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "loading-indicator";
  loadingIndicator.innerHTML =
    '<div class="spinner"></div><p>Loading translation...</p>';

  // Show loading indicator
  svgContainer.innerHTML = "";
  svgContainer.appendChild(loadingIndicator);

  // Fetch the SVG for the selected language
  fetch(`assets/images/cognitive_bias_codex_${language}.svg`)
    .then((response) => {
      if (!response.ok) {
        // Fallback to English if the language version doesn't exist
        return fetch("assets/images/cognitive_bias_codex_en.svg");
      }
      return response;
    })
    .then((response) => response.text())
    .then((svgContent) => {
      // Remove loading indicator
      svgContainer.removeChild(loadingIndicator);

      // Insert new SVG content
      svgContainer.innerHTML = svgContent;

      // Reinitialize tooltips and panzoom
      requestAnimationFrame(() => {
        loadBiasesContent().then((biasesContent) => {
          initializeTooltips(biasesContent);
        });
        initializePanZoom();
      });
    })
    .catch((error) => {
      console.error("Error loading SVG for language:", error);
      svgContainer.innerHTML = `<p class="error">Error loading translation. Refreshing the page may help.</p>`;
    });
}

// Add the rest of your functions for pan, zoom, etc.
function initializePanZoom() {
  const svgContainer = document.getElementById("svg-container");
  const svg = svgContainer.querySelector("svg");

  if (!svg) {
    console.warn("SVG not found for pan/zoom initialization");
    return;
  }

  // Variables for pan functionality
  let isPanning = false;
  let startPoint = { x: 0, y: 0 };
  let viewBox = { x: 0, y: 0, width: 1900, height: 1500 };

  // Initialize viewBox from SVG
  const initialViewBox = svg.getAttribute("viewBox");
  if (initialViewBox) {
    const parts = initialViewBox.split(" ");
    viewBox = {
      x: parseFloat(parts[0]),
      y: parseFloat(parts[1]),
      width: parseFloat(parts[2]),
      height: parseFloat(parts[3]),
    };
  }

  // Pan functions
  function startPan(e) {
    // Skip if this is a link element
    if (e.target.closest("a")) return;

    const event = e.type.startsWith("touch") ? e.touches[0] : e;
    isPanning = true;
    startPoint = { x: event.clientX, y: event.clientY };
  }

  function movePan(e) {
    if (!isPanning) return;
    e.preventDefault();

    const event = e.type.startsWith("touch") ? e.touches[0] : e;
    const dx =
      ((event.clientX - startPoint.x) * viewBox.width) /
      svgContainer.clientWidth;
    const dy =
      ((event.clientY - startPoint.y) * viewBox.height) /
      svgContainer.clientHeight;

    viewBox.x -= dx;
    viewBox.y -= dy;

    startPoint = { x: event.clientX, y: event.clientY };
    updateViewBox();
  }

  function endPan() {
    isPanning = false;
  }

  function updateViewBox() {
    svg.setAttribute(
      "viewBox",
      `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
    );
  }

  // Zoom function
  function handleZoom(e) {
    e.preventDefault();

    const delta = e.deltaY;
    const zoomFactor = delta > 0 ? 1.1 : 0.9;

    // Calculate zoom point in SVG coordinates
    const rect = svgContainer.getBoundingClientRect();
    const mouseX =
      ((e.clientX - rect.left) / rect.width) * viewBox.width + viewBox.x;
    const mouseY =
      ((e.clientY - rect.top) / rect.height) * viewBox.height + viewBox.y;

    // Calculate new dimensions
    const newWidth = viewBox.width * zoomFactor;
    const newHeight = viewBox.height * zoomFactor;

    viewBox.x = mouseX - ((mouseX - viewBox.x) / viewBox.width) * newWidth;
    viewBox.y = mouseY - ((mouseY - viewBox.y) / viewBox.height) * newHeight;
    viewBox.width = newWidth;
    viewBox.height = newHeight;

    updateViewBox();
  }

  // Add event listeners
  if (!isMobileDevice()) {
    // Desktop events
    svg.addEventListener("mousedown", startPan);
    window.addEventListener("mousemove", movePan);
    window.addEventListener("mouseup", endPan);
    svg.addEventListener("wheel", handleZoom);
  } else {
    // Mobile events with pinch zoom support
    svg.addEventListener("touchstart", startPan);
    window.addEventListener("touchmove", movePan);
    window.addEventListener("touchend", endPan);

    // Initial mobile view adjustment
    if (window.innerHeight > window.innerWidth) {
      // Portrait mode - zoom to center
      svg.setAttribute("viewBox", "600 300 700 900");
    }
  }

  // Add zoom controls for mobile
  if (isMobileDevice()) {
    addZoomControls();
  }
}

function addZoomControls() {
  // Remove any existing zoom controls first
  const existingControls = document.querySelector(".zoom-controls");
  if (existingControls) {
    document.body.removeChild(existingControls);
  }

  const zoomControls = document.createElement("div");
  zoomControls.className = "zoom-controls";
  zoomControls.innerHTML = `
        <button class="zoom-in">+</button>
        <button class="zoom-reset">Reset</button>
        <button class="zoom-out">-</button>
    `;

  document.body.appendChild(zoomControls);

  document.querySelector(".zoom-in").addEventListener("click", () => {
    const svg = document.querySelector("#svg-container svg");
    const viewBox = svg.getAttribute("viewBox").split(" ").map(Number);
    const newWidth = viewBox[2] * 0.8;
    const newHeight = viewBox[3] * 0.8;
    const newX = viewBox[0] + (viewBox[2] - newWidth) / 2;
    const newY = viewBox[1] + (viewBox[3] - newHeight) / 2;
    svg.setAttribute("viewBox", `${newX} ${newY} ${newWidth} ${newHeight}`);
  });

  document.querySelector(".zoom-out").addEventListener("click", () => {
    const svg = document.querySelector("#svg-container svg");
    const viewBox = svg.getAttribute("viewBox").split(" ").map(Number);
    const newWidth = viewBox[2] * 1.2;
    const newHeight = viewBox[3] * 1.2;
    const newX = viewBox[0] - (newWidth - viewBox[2]) / 2;
    const newY = viewBox[1] - (newHeight - viewBox[3]) / 2;
    svg.setAttribute("viewBox", `${newX} ${newY} ${newWidth} ${newHeight}`);
  });

  document.querySelector(".zoom-reset").addEventListener("click", () => {
    const svg = document.querySelector("#svg-container svg");
    svg.setAttribute("viewBox", "0 0 1900 1500");
  });
}

function initializeMobileView() {
  if (!isMobileDevice()) return;

  // Skip showing orientation help if already shown previously
  if (localStorage.getItem("orientation-help-shown")) return;

  // Add orientation message
  const orientationHelp = document.createElement("div");
  orientationHelp.className = "orientation-help";
  orientationHelp.innerHTML = `
        <div class="orientation-content">
            <p>For better viewing, rotate your device to landscape or use pinch gestures to zoom.</p>
            <button class="dismiss-orientation">Got it</button>
        </div>
    `;

  document.body.appendChild(orientationHelp);

  setTimeout(() => {
    orientationHelp.classList.add("show");
  }, 1000);

  document
    .querySelector(".dismiss-orientation")
    .addEventListener("click", () => {
      orientationHelp.classList.remove("show");
      localStorage.setItem("orientation-help-shown", "true");
    });
}

function initializeInfoPanel() {
  const infoButton = document.querySelector(".info-button");
  const infoPanel = document.querySelector(".info-panel");
  const closeInfo = document.querySelector(".close-info");

  if (!infoButton || !infoPanel || !closeInfo) return;

  infoButton.addEventListener("click", function () {
    infoPanel.classList.toggle("show");
  });

  closeInfo.addEventListener("click", function () {
    infoPanel.classList.remove("show");
  });

  // Close info panel when clicking outside
  document.addEventListener("click", function (event) {
    if (!infoPanel.contains(event.target) && event.target !== infoButton) {
      infoPanel.classList.remove("show");
    }
  });
}

// Function to load and parse biases content
function loadBiasesContent() {
  return fetch("biases_wikipedia.html")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to load biases content");
      }
      return response.text();
    })
    .then((html) => {
      // Parse the HTML to extract bias content
      const biasesContent = {};
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Get all bias elements
      const biasElements = doc.querySelectorAll(".bias");

      biasElements.forEach((biasElement) => {
        const titleElement = biasElement.querySelector("h2");
        const contentElement = biasElement.querySelector(".content");

        if (titleElement && contentElement) {
          const biasName = titleElement.textContent.trim();
          // Store both the HTML content and a simplified version of the name for matching
          biasesContent[biasName.toLowerCase().replace(/\s+/g, "-")] = {
            name: biasName,
            content: contentElement.innerHTML,
          };
        }
      });

      return biasesContent;
    });
}
