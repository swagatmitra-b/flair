// cleanup job to remove expired sessions and blocks
// Debashish Buragohain
import { prisma } from '../lib/prisma/index.js';
import cron from 'node-cron';
export function startCleanupJob() {
    // Run every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        console.log('Running session cleanup job...');
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        try {
            // Delete expired/consumed sessions
            const deletedSessions = await prisma.commitCreationSession.deleteMany({
                where: {
                    OR: [
                        { expiresAt: { lt: now } },
                        { consumed: true, createdAt: { lt: oneHourAgo } },
                        { status: 'ERROR', lastErrorAt: { lt: oneHourAgo } }
                    ]
                }
            });
            // Delete expired blocks
            const deletedBlocks = await prisma.initiationBlock.deleteMany({
                where: { blockedUntil: { lt: now } }
            });
            console.log(`Cleanup complete: ${deletedSessions.count} sessions, ${deletedBlocks.count} blocks removed`);
        }
        catch (err) {
            console.error('Cleanup job error:', err);
        }
    });
}
