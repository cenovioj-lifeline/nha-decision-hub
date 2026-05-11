import { SignJWT } from 'jose';

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(c => {
    const [key, ...rest] = c.trim().split('=');
    cookies[key] = rest.join('=');
  });
  return cookies;
}

export default async function handler(req, res) {
  try {
    const clientId = process.env.OKTA_CLIENT_ID;
    const clientSecret = process.env.OKTA_CLIENT_SECRET;
    const domain = process.env.OKTA_DOMAIN || 'sso.nhaschools.com';
    const sessionSecret = process.env.SESSION_SECRET;
    if (!clientId || !clientSecret || !sessionSecret) {
      return res.status(500).json({ error: 'Auth env vars not fully configured' });
    }

    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.status(400).send(`<html><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;max-width:500px;margin:0 auto"><h2>Sign-in failed</h2><p>${error_description || error}</p><p style="margin-top:24px"><a href="/" style="color:#003865;font-weight:600">Back to Decision Hub</a></p></body></html>`);
    }
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const cookies = parseCookies(req.headers.cookie);
    if (cookies.okta_state !== state) {
      return res.status(403).send(`<html><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;max-width:500px;margin:0 auto"><h2>Session expired</h2><p style="color:#666">Your sign-in session expired. Please try again.</p><p style="margin-top:24px"><a href="/api/auth/login" style="display:inline-block;padding:12px 24px;background:#003865;color:white;text-decoration:none;border-radius:8px;font-weight:600">Sign in</a></p></body></html>`);
    }

    const redirectUri = `https://${req.headers.host}/callback`;
    const tokenUrl = `https://${domain}/oauth2/default/v1/token`;

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    let tokenData;
    try {
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });
      tokenData = await tokenRes.json();
    } catch (err) {
      return res.status(500).json({ error: 'Token exchange failed', details: err.message });
    }

    if (tokenData.error) {
      return res.status(400).send(`<html><body style="font-family:Arial,sans-serif;padding:40px;text-align:center"><h2>Sign-in failed</h2><p>${tokenData.error_description || tokenData.error}</p><p style="margin-top:20px"><a href="/">Back</a></p></body></html>`);
    }

    let userInfo = {};
    if (tokenData.access_token) {
      try {
        const r = await fetch(`https://${domain}/oauth2/default/v1/userinfo`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        userInfo = await r.json();
      } catch { /* ignore */ }
    }
    let idClaims = {};
    if (tokenData.id_token) {
      try {
        const payload = tokenData.id_token.split('.')[1];
        idClaims = JSON.parse(Buffer.from(payload, 'base64url').toString());
      } catch { /* ignore */ }
    }

    const session = {
      sub: userInfo.sub || idClaims.sub,
      name: userInfo.name || idClaims.name || '',
      email: userInfo.email || idClaims.email || '',
      given_name: userInfo.given_name || idClaims.given_name || '',
      family_name: userInfo.family_name || idClaims.family_name || '',
      groups: userInfo.groups || idClaims.groups || [],
    };

    // App-layer gate: dhub.allowed_users (cjaimes, kbraun, jsandner, dadams).
    const userEmail = String(session.email || '').toLowerCase();
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!userEmail) {
      res.setHeader('Set-Cookie', [`okta_state=; HttpOnly; Secure; Path=/; Max-Age=0`]);
      return res.redirect(302, '/no-access?reason=no-email');
    }
    if (supabaseUrl && supabaseKey) {
      try {
        const checkUrl = `${supabaseUrl}/rest/v1/allowed_users?email=eq.${encodeURIComponent(userEmail)}&select=email,is_admin&limit=1`;
        const accessRes = await fetch(checkUrl, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Accept-Profile': 'dhub',
          },
        });
        const rows = await accessRes.json();
        if (!Array.isArray(rows) || rows.length === 0) {
          res.setHeader('Set-Cookie', [`okta_state=; HttpOnly; Secure; Path=/; Max-Age=0`]);
          return res.redirect(302, '/no-access?email=' + encodeURIComponent(userEmail));
        }
        // Carry is_admin into the session
        session.is_admin = !!rows[0].is_admin;
      } catch (err) {
        console.error('Decision Hub access gate check failed', err);
        res.setHeader('Set-Cookie', [`okta_state=; HttpOnly; Secure; Path=/; Max-Age=0`]);
        return res.redirect(302, '/no-access?reason=gate-error');
      }
    } else {
      console.error('Supabase env vars missing — gate cannot run');
      res.setHeader('Set-Cookie', [`okta_state=; HttpOnly; Secure; Path=/; Max-Age=0`]);
      return res.redirect(302, '/no-access?reason=gate-misconfigured');
    }

    const jwt = await new SignJWT(session)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(sessionSecret));

    res.setHeader('Set-Cookie', [
      `okta_state=; HttpOnly; Secure; Path=/; Max-Age=0`,
      `dh_session=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`,
    ]);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    res.status(500).json({ error: 'Callback failed', details: err.message });
  }
}
