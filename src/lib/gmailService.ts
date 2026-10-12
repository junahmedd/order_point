// Gmail integration service for OrderPoint Pro
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, getRedirectResult } from 'firebase/auth';

// In-memory token cache (Do NOT store in localStorage/sessionStorage as per OAuth Skill guidelines)
let inMemoryAccessToken: string | null = null;
let tokenExpiresAt: number | null = null; // Timestamp in milliseconds

export function getGmailAccessToken(): string | null {
  if (inMemoryAccessToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return inMemoryAccessToken;
  }
  // Clear expired token
  if (inMemoryAccessToken) {
    inMemoryAccessToken = null;
    tokenExpiresAt = null;
  }
  return null;
}

export function setGmailAccessToken(token: string, expiresInSeconds: number = 3599) {
  inMemoryAccessToken = token;
  // Expire 1 minute early for a safety margin
  tokenExpiresAt = Date.now() + (expiresInSeconds - 60) * 1000;
  console.log(`[GmailService] Cached fresh Gmail OAuth token. Expires in: ${expiresInSeconds}s`);
}

export function clearGmailAccessToken() {
  inMemoryAccessToken = null;
  tokenExpiresAt = null;
}

export function hasGmailAccessToken(): boolean {
  return !!getGmailAccessToken();
}

/**
 * Prompt the user to authorize Gmail scopes specifically.
 * We add the Gmail scopes explicitly to the provider.
 */
export async function authorizeGmailService(): Promise<string> {
  const provider = new GoogleAuthProvider();
  
  // Set custom prompt to ensure account selector is shown and we ask for required scopes
  provider.setCustomParameters({
    prompt: 'consent',
  });

  // Request all necessary Gmail scopes
  provider.addScope('https://www.googleapis.com/auth/gmail.send');
  provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
  provider.addScope('https://www.googleapis.com/auth/gmail.modify');
  provider.addScope('https://mail.google.com/');

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('OAuth flow completed, but no access token was returned by Google.');
    }

    // Usually Google Access Tokens are valid for 1 hour (3600 seconds)
    setGmailAccessToken(token, 3600);
    return token;
  } catch (error: any) {
    console.error('[GmailService] Error during Gmail authorization:', error);
    throw error;
  }
}

/**
 * Constructs a multi-part MIME message with an optional PDF attachment and sends it via the Gmail REST API.
 */
export async function sendEmailViaGmail({
  to,
  subject,
  bodyHtml,
  pdfBase64,
  pdfFileName = 'invoice.pdf'
}: {
  to: string;
  subject: string;
  bodyHtml: string;
  pdfBase64?: string;
  pdfFileName?: string;
}): Promise<{ success: boolean; messageId: string }> {
  const token = getGmailAccessToken();
  if (!token) {
    throw new Error('Gmail API credentials are not active. Please authenticate.');
  }

  const currentUser = auth.currentUser;
  const fromEmail = currentUser?.email || 'me';
  const fromName = currentUser?.displayName || 'OrderPoint Pro Partner';
  const fromHeader = `"${fromName}" <${fromEmail}>`;

  let rawMessageB64Url = '';

  if (pdfBase64) {
    // MIME message with pdf attachment
    const boundary = `boundary_orderpointpro_${Date.now().toString(16)}`;

    // Ensure we have a clean base64 string
    let cleanPdfBase64 = pdfBase64;
    if (pdfBase64.startsWith('data:')) {
      const parts = pdfBase64.split(',');
      if (parts.length > 1) {
        cleanPdfBase64 = parts[1];
      }
    }

    // Strip any whitespaces or newlines from cleanPdfBase64
    cleanPdfBase64 = cleanPdfBase64.replace(/\s/g, '');

    const mimeParts = [
      `MIME-Version: 1.0`,
      `To: ${to}`,
      `From: ${fromHeader}`,
      `Subject: ${subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      bodyHtml,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFileName}"`,
      `Content-Description: ${pdfFileName}`,
      `Content-Disposition: attachment; filename="${pdfFileName}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      cleanPdfBase64,
      ``,
      `--${boundary}--`
    ];

    const mimeMessageString = mimeParts.join('\r\n');
    
    // Safely Base64url-encode the Unicode MIME message
    const utf8Bytes = new TextEncoder().encode(mimeMessageString);
    let binary = '';
    const len = utf8Bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const b64 = btoa(binary);
    rawMessageB64Url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  } else {
    // Simple MIME message without attachment
    const mimeParts = [
      `MIME-Version: 1.0`,
      `To: ${to}`,
      `From: ${fromHeader}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      bodyHtml
    ];

    const mimeMessageString = mimeParts.join('\r\n');
    const utf8Bytes = new TextEncoder().encode(mimeMessageString);
    let binary = '';
    const len = utf8Bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const b64 = btoa(binary);
    rawMessageB64Url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // POST request to send message
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: rawMessageB64Url
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[GmailService] Send error details:', errorData);
    throw new Error(errorData.error?.message || `Failed to send email via Gmail API (Status ${response.status})`);
  }

  const result = await response.json();
  return {
    success: true,
    messageId: result.id
  };
}
