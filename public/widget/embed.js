/**
 * CupMetrics Widget Embed Script
 * Story 11.20 - Embeddable producer widget
 */

(function () {
  "use strict";

  // Find all widget containers
  var containers = document.querySelectorAll("[data-cupmetrics-widget]");

  containers.forEach(function (container) {
    var producerId = container.getAttribute("data-producer-id");
    if (!producerId) {
      console.error("CupMetrics Widget: data-producer-id attribute is required");
      return;
    }

    // Get customization options
    var width = container.getAttribute("data-width") || "350";
    var height = container.getAttribute("data-height") || "400";
    var theme = container.getAttribute("data-theme") || "light";

    // Build widget URL
    var baseUrl = "https://cupmetrics.com"; // Will be replaced by actual domain
    var widgetUrl = baseUrl + "/widget/producer/" + producerId;
    if (theme === "dark") {
      widgetUrl += "?theme=dark";
    }

    // Create iframe
    var iframe = document.createElement("iframe");
    iframe.src = widgetUrl;
    iframe.width = width;
    iframe.height = height;
    iframe.frameBorder = "0";
    iframe.style.borderRadius = "8px";
    iframe.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
    iframe.style.border = "none";
    iframe.title = "CupMetrics - Distinctions producteur";
    iframe.loading = "lazy";

    // Insert iframe
    container.innerHTML = "";
    container.appendChild(iframe);
  });
})();
