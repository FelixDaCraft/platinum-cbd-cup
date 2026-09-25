/**
 * Module email partagé du serveur : client Resend unique, envoi centralisé,
 * gabarit commun et échappement. Tout template transactionnel passe par ici.
 */

export { getResendClient } from "./client";
export { escapeHtml, safeUrl } from "./escape";
export {
  renderButton,
  renderCallout,
  renderEmailLayout,
  renderFallbackLink,
  renderGreeting,
  renderHighlight,
  renderParagraph,
  renderQuote,
  type EmailLayoutParams,
} from "./layout";
export { sendEmail, type SendEmailParams, type SendEmailResult } from "./send";
export { mapWithConcurrency, EMAIL_SEND_CONCURRENCY } from "./batch";
