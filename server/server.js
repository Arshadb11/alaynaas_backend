const app = require('./src/app');
const config = require('./src/config/env');
const winstonLogger = require('./src/config/winston');
const { startTrashPurgeJob } = require('./src/jobs/trashPurge');

app.listen(config.port, () => {
  winstonLogger.info(`Server started on port ${config.port}`, {
    env: config.nodeEnv,
    cors: config.cors.origin,
  });
  console.log(`\n  Perfume Admin API running at http://localhost:${config.port}`);
  console.log(`  Environment: ${config.nodeEnv}\n`);
  startTrashPurgeJob();
});
