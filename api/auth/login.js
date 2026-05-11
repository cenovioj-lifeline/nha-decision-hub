// Vercel serverless function. ESM (package.json type=module).
import crypto from 'node:crypto';

export default async function handler(req, res) {
  try {
    const clientId = process.env.OKTA_CLIENT_ID;
    const domain = process.env.OKTA_DOMAIN || 'sso.nhaschools.com';
    if (!clientId) {
      return res.status(500).json({ error: 'OKTA_CLIENT_ID not configured' });
    }

    const state = Buffer.from(JSON.stringify({
      nonce: crypto.randomBytes(16).toString('hex'),
    })).toString('base64url');

    const redirectUri = `https://${req.headers.host}/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: redirectUri,
      state,
    });

    const authorizeUrl = `https://${domain}/oauth2/default/v1/authorize?${params}`;

    res.setHeader('Set-Cookie', `okta_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
    res.status(200).send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${authorizeUrl}"></head><body><p>Redirecting to sign in&hellip;</p><script>window.location.href=${JSON.stringify(authorizeUrl)};</script></body></html>`);
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
}
