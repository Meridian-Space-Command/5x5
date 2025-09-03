import Fastify from 'fastify';

const server = Fastify({ logger: true });

server.get('/health', async () => ({ ok: true }));

const port = Number(process.env.PORT || 4000);

server.listen({ port, host: '0.0.0.0' })
  .then(() => {
    server.log.info(`API listening on ${port}`);
  })
  .catch((err) => {
    server.log.error(err);
    process.exit(1);
  });


