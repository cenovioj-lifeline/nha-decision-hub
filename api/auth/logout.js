export default async function handler(req, res) {
  res.setHeader('Set-Cookie', 'dh_session=; HttpOnly; Secure; Path=/; Max-Age=0');
  res.writeHead(302, { Location: '/' });
  res.end();
}
