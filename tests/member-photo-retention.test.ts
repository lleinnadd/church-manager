import { beforeEach, describe, expect, it, vi } from 'vitest';

import { safeDeleteBlob } from '../server/utils/member-photo';

const mocks = vi.hoisted(() => ({ registration: vi.fn(), member: vi.fn(), del: vi.fn() }));
vi.mock('../server/utils/prisma', () => ({
  default: {
    memberRegistration: { findFirst: mocks.registration },
    member: { findFirst: mocks.member },
  },
}));
vi.mock('@vercel/blob', () => ({ del: mocks.del, put: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token');
  mocks.registration.mockResolvedValue(null);
  mocks.member.mockResolvedValue(null);
});

describe('registration photo retention', () => {
  it('retains a photo referenced by a registration or its decision history', async () => {
    mocks.registration.mockResolvedValue({ id: 'history-reference' });
    await safeDeleteBlob('members/photos/reviewed.png');
    expect(mocks.del).not.toHaveBeenCalled();
  });
  it('retains the current member photo', async () => {
    mocks.member.mockResolvedValue({ id: 'member-reference' });
    await safeDeleteBlob('members/photos/current.png');
    expect(mocks.del).not.toHaveBeenCalled();
  });
  it('deletes unreferenced uploads', async () => {
    await safeDeleteBlob('members/photos/unused.png');
    expect(mocks.del).toHaveBeenCalledExactlyOnceWith('members/photos/unused.png', {
      token: 'test-token',
    });
  });
  it('retains the photo when reference checks fail', async () => {
    mocks.registration.mockRejectedValue(new Error('Database unavailable'));
    await expect(safeDeleteBlob('members/photos/uncertain.png')).resolves.toBeUndefined();
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
