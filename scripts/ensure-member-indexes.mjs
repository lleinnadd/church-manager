import 'dotenv/config';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { MongoClient } from 'mongodb';

// MongoDB's default unique index allows only one null/missing account ID.
// Keep account IDs unique while allowing any number of members without accounts.
export async function ensureMemberAccountIndex(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const client = new MongoClient(databaseUrl);
  try {
    // Use the driver directly: Prisma interprets MongoDB's $type predicate as
    // its own JSON protocol tag and cannot decode existing index metadata.
    const members = client.db().collection('members');
    const indexes = await members.listIndexes().toArray();
    const index = indexes.find((item) => item.name === 'members_clerkUserId_key');
    const predicate = index?.partialFilterExpression?.clerkUserId;
    if (index?.unique && (predicate?.$type === 'string' || predicate?.$gt === '')) return;
    if (index) await members.dropIndex(index.name);
    await members.createIndex(
      { clerkUserId: 1 },
      {
        name: 'members_clerkUserId_key',
        unique: true,
        partialFilterExpression: { clerkUserId: { $type: 'string' } },
      },
    );
  } finally {
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await ensureMemberAccountIndex();
}
