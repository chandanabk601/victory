import app from './app';
import { config } from './config';
import { testDbConnection, pool } from './database/db';
import { CryptoService } from './services/crypto.service';

const startServer = async () => {
  try {
    // 1. Verify and prepare local cryptographic key storage
    CryptoService.ensureKeysDirectory();
    console.log(`[Crypto] Secure key storage initialized at: ${config.keys.storageDir}`);

    // 2. Check Database Connectivity
    const dbConnected = await testDbConnection();
    if (!dbConnected) {
      console.warn('[Warning] PostgreSQL is currently unreachable on configured host:port. Ensure database service is running.');
    }

    // 3. Start HTTP server
    const server = app.listen(config.port, () => {
      console.log('====================================================');
      console.log('  VICTORY: Pharmaceutical Verification Platform API');
      console.log(`  Running on: http://localhost:${config.port}${config.apiPrefix}`);
      console.log(`  Environment: ${config.nodeEnv}`);
      console.log('====================================================');
    });

    // Graceful shutdown handling
    const shutdown = async () => {
      console.log('\n[Server] Gracefully shutting down...');
      server.close(async () => {
        await pool.end();
        console.log('[Server] Connections closed. Exiting process.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('[Server Error] Startup failed:', err);
    process.exit(1);
  }
};

startServer();
