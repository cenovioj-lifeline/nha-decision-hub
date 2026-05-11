import { jwtVerify } from 'jose';

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
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.dh_session;
  if (!token) return res.status(200).json({ authenticated: false });

  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return res.status(200).json({
      authenticated: true,
      user: {
        name: payload.name,
        email: payload.email,
        given_name: payload.given_name,
        family_name: payload.family_name,
        is_admin: !!payload.is_admin,
      },
    });
  } catch {
    res.setHeader('Set-Cookie', 'dh_session=; HttpOnly; Secure; Path=/; Max-Age=0');
    return res.status(200).json({ authenticated: false });
  }
}
