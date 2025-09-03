import Fastify from 'fastify';
import cors from '@fastify/cors';
import { AccessToken } from 'livekit-server-sdk';
import crypto from 'crypto';

const server = Fastify({ logger: true });

server.register(cors, { origin: true });

server.get('/health', async () => ({ ok: true }));

server.post('/token', async (req, res) => {
  try {
    const { room, identity, name, metadata } = (req.body as any) ?? {};
    if (!room || !identity) {
      return res.code(400).send({ error: 'room and identity required' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY ?? 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET ?? 'devsecret';

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();
    return { token };
  } catch (e: any) {
    server.log.error(e);
    return res.code(500).send({ error: 'failed to issue token' });
  }
});

server.get('/turn', async (req, res) => {
  const secret = process.env.TURN_SHARED_SECRET;
  const domain = process.env.TURN_DOMAIN || 'localhost';
  const port = Number(process.env.TURN_PORT || 3478);
  if (!secret) {
    return res.code(500).send({ error: 'TURN not configured' });
  }
  const ttl = 3600; // 1h
  const username = `${Math.floor(Date.now() / 1000) + ttl}:fivebyfive`;
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(username);
  const credential = hmac.digest('base64');
  const urls = [
    `turn:${domain}:${port}?transport=udp`,
    `turn:${domain}:${port}?transport=tcp`,
  ];
  return { iceServers: [{ urls, username, credential }] };
});

const port = Number(process.env.PORT || 4000);

async function start() {
  try {
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`API listening on ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();


