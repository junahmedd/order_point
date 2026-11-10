/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Detects whether the current device is a mobile phone (Android, iOS, etc.)
 * vs a desktop/laptop computer.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  const isTouchMac = navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/i.test(ua);
  return mobileRegex.test(ua) || Boolean(isTouchMac);
}

/**
 * Normalizes a phone number for international WhatsApp formatting.
 * For standard 10-digit Indian numbers, prepends '91'.
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Builds the official OrderPoint Pro restaurant billing message.
 */
export function buildRestaurantBillingMessage({
  customerName,
  restaurantName,
  totalAmount,
  invoiceNumber,
  invoicePdfLink
}: {
  customerName?: string;
  restaurantName?: string;
  totalAmount: number | string;
  invoiceNumber: string;
  invoicePdfLink?: string;
}): string {
  let resolvedName = customerName?.trim() || 'Guest';
  // Clean up automated label names like Dine-In (Table 1) into clean diner name
  if (resolvedName.toLowerCase().startsWith('dine-in') || resolvedName.toLowerCase().startsWith('table')) {
    resolvedName = 'Guest';
  }

  const rest = restaurantName?.trim() || 'OrderPoint Pro';
  const amount = typeof totalAmount === 'number' ? totalAmount.toFixed(2) : totalAmount;
  const linkSection = invoicePdfLink ? `\n\n📄 View / Download Invoice PDF:\n${invoicePdfLink}` : '';

  return `Hello ${resolvedName}!\n\nThank you for dining with us at ${rest}.\n\nYour bill of ₹${amount} has been generated successfully.\n\nInvoice: ${invoiceNumber}${linkSection}\n\nWe hope to serve you again! 😊`;
}

/**
 * Dispatches a WhatsApp message:
 * - On Mobile: Uses deep linking via https://wa.me/ to open the WhatsApp mobile application directly.
 * - On Desktop/Laptop: Uses https://web.whatsapp.com/send to open WhatsApp Web in a new tab.
 */
export function dispatchWhatsAppMessage({
  phone,
  message
}: {
  phone: string;
  message: string;
}): { url: string; isMobile: boolean } {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const encodedMessage = encodeURIComponent(message);
  const mobile = isMobileDevice();

  const desktopUrl = `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedMessage}`;
  const mobileUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  const targetUrl = mobile ? mobileUrl : desktopUrl;

  if (typeof window !== 'undefined') {
    if (mobile) {
      // Trigger native WhatsApp application directly on mobile phones
      window.location.href = mobileUrl;
    } else {
      // Open WhatsApp Web in a dedicated new tab on desktop/laptop
      const win = window.open(desktopUrl, '_blank', 'noopener,noreferrer');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        const a = document.createElement('a');
        a.href = desktopUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  }

  return { url: targetUrl, isMobile: mobile };
}
