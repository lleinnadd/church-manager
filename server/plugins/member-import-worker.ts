import { importEnabled } from '../utils/member-import-extraction';
import { processNextImport } from '../utils/member-import-worker';

export default defineNitroPlugin((nitroApp) => {
  if (!importEnabled()) return;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processNextImport();
    } catch {
      console.warn('Member import worker unavailable; check local configuration and database.');
    } finally {
      running = false;
    }
  }, 2000);
  timer.unref();
  nitroApp.hooks.hook('close', () => {
    clearInterval(timer);
  });
});
