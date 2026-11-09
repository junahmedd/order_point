/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sequential series helpers for OrderPoint Pro:
 * Order Numbers: OP-001, OP-002, OP-003, ...
 * Token Numbers: TK-01, TK-02, TK-03, ...
 * Invoice Numbers: INV-001, INV-002, INV-003, ...
 */

export function formatPad(num: number, digits: number): string {
  return String(num).padStart(digits, '0');
}

/**
 * Derives the next sequential Order Number: OP-001, OP-002, ...
 */
export function getNextOrderNumber(orders: any[] = []): string {
  let maxNum = 0;
  for (const o of orders) {
    if (!o.orderNumber) continue;
    const match = String(o.orderNumber).match(/OP-?(\d+)/i) || String(o.orderNumber).match(/(\d+)/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val < 10000 && val > maxNum) {
        maxNum = val;
      }
    }
  }
  return `OP-${formatPad(maxNum + 1, 3)}`;
}

/**
 * Derives the next sequential Token Number: TK-01, TK-02, ...
 */
export function getNextTokenNumber(orders: any[] = []): string {
  let maxNum = 0;
  for (const o of orders) {
    const raw = o.orderToken || o.tokenNumber || o.orderNumber;
    if (!raw) continue;
    const match = String(raw).match(/TK-?(\d+)/i) || String(raw).match(/A0*(\d+)/i) || String(raw).match(/(\d+)/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val < 1000 && val > maxNum) {
        maxNum = val;
      }
    }
  }
  return `TK-${formatPad(maxNum + 1, 2)}`;
}

/**
 * Derives the next sequential Invoice Number: INV-001, INV-002, ...
 */
export function getNextInvoiceNumber(orders: any[] = []): string {
  let maxNum = 0;
  for (const o of orders) {
    const inv = o.invoiceNumber || o.invoiceNo;
    if (!inv) continue;
    const match = String(inv).match(/INV-?(\d+)/i);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val < 10000 && val > maxNum) {
        maxNum = val;
      }
    }
  }
  return `INV-${formatPad(maxNum + 1, 3)}`;
}

/**
 * Format a token string for display: always returns clean "TK-01", "TK-02", etc.
 */
export function formatTokenDisplay(token: any, fallbackIndex = 1): string {
  if (!token) return `TK-${formatPad(fallbackIndex, 2)}`;
  const str = String(token).trim();
  if (/^TK-\d+$/i.test(str)) return str.toUpperCase();
  const cleanNum = str.replace(/\D/g, '');
  if (cleanNum) {
    const num = parseInt(cleanNum, 10);
    if (num < 100) return `TK-${formatPad(num, 2)}`;
    return `TK-${formatPad(num % 100 || 1, 2)}`;
  }
  return `TK-${str}`;
}

/**
 * Format an order number for display: always returns clean "OP-001", "OP-002", etc.
 */
export function formatOrderNumberDisplay(orderNum: any, fallbackIndex = 1): string {
  if (!orderNum) return `OP-${formatPad(fallbackIndex, 3)}`;
  const str = String(orderNum).trim();
  if (/^OP-\d{3,}$/i.test(str)) return str.toUpperCase();
  const cleanNum = str.replace(/\D/g, '');
  if (cleanNum) {
    const num = parseInt(cleanNum, 10);
    if (num < 1000) return `OP-${formatPad(num, 3)}`;
    return `OP-${formatPad(num % 1000 || 1, 3)}`;
  }
  return `OP-${str}`;
}

/**
 * Format an invoice number for display: always returns clean "INV-001", "INV-002", etc.
 */
export function formatInvoiceNumberDisplay(inv: any, orderNumber?: string, fallbackIndex = 1): string {
  if (inv && /^INV-\d{3,}$/i.test(String(inv).trim())) return String(inv).trim().toUpperCase();
  if (orderNumber) {
    const match = String(orderNumber).match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      return `INV-${formatPad(num < 1000 ? num : (num % 1000 || 1), 3)}`;
    }
  }
  return `INV-${formatPad(fallbackIndex, 3)}`;
}
