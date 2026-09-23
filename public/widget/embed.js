/**
 * Platinum CBD Cup — producer widget embed script.
 *
 * Usage on a third-party page:
 *   <div data-platinum-widget data-producer-id="..."></div>
 *   <script src="https://platinumcbdcup.eu/widget/embed.js" async></script>
 */

(function () {
  "use strict";

  /**
   * Derive the origin from this script's own URL, so the embed always points
   * back at the host that served it. `document.currentScript` is null inside
   * the async callback, so it is captured immediately.
   */
  var currentScript = document.currentScript;

  function resolveBaseUrl() {
    if (currentScript && currentScript.src) {
      try {
        return new URL(currentScript.src).origin;
      } catch (e) {
        /* fall through */
      }
    }
    return "https://platinumcbdcup.eu";
  }

  function render(baseUrl) {
    var containers = document.querySelectorAll("[data-platinum-widget]");

    Array.prototype.forEach.call(containers, function (container) {
      if (container.getAttribute("data-platinum-widget-ready") === "true") {
        return;
      }

      var producerId = container.getAttribute("data-producer-id");
      if (!producerId) {
        console.error(
          "Platinum CBD Cup widget: l'attribut data-producer-id est requis"
        );
        return;
      }

      var width = container.getAttribute("data-width") || "350";
      var height = container.getAttribute("data-height") || "400";
      var theme = container.getAttribute("data-theme") || "light";

      var widgetUrl =
        baseUrl + "/widget/producer/" + encodeURIComponent(producerId);
      if (theme === "dark") {
        widgetUrl += "?theme=dark";
      }

      var iframe = document.createElement("iframe");
      iframe.src = widgetUrl;
      iframe.width = width;
      iframe.height = height;
      iframe.setAttribute("frameborder", "0");
      iframe.style.borderRadius = "8px";
      iframe.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
      iframe.style.border = "none";
      iframe.style.maxWidth = "100%";
      iframe.title = "Distinctions Platinum CBD Cup";
      iframe.loading = "lazy";

      container.innerHTML = "";
      container.appendChild(iframe);
      container.setAttribute("data-platinum-widget-ready", "true");
    });
  }

  var baseUrl = resolveBaseUrl();

  // `async` scripts can run before the containers exist in the DOM.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      render(baseUrl);
    });
  } else {
    render(baseUrl);
  }
})();
