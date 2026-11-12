import { describe, test, expect, vi } from 'vitest';
import { run, type SuperUserCommandDeps } from './superuser.js';

const LOCAL = 'mongodb://localhost:27017/cams';

function fakeDeps() {
  const close = vi.fn().mockResolvedValue(undefined);
  const deps = {
    openStore: vi.fn().mockResolvedValue({ store: {}, close }),
    grantSuperUser: vi.fn().mockResolvedValue({ outcome: 'granted', assignment: {} }),
    revokeSuperUser: vi.fn().mockResolvedValue({ outcome: 'revoked', assignment: {} }),
  };
  return { deps: deps as unknown as SuperUserCommandDeps, ...deps, close };
}

describe('superuser command', () => {
  test('should refuse a non-local host before connecting', async () => {
    const { deps, openStore } = fakeDeps();
    const remote = 'mongodb://acct:key@cosmos-mongo-ustp-cams-dev.mongo.cosmos.azure.us:10255/'; // pragma: allowlist secret

    await expect(run(['grant'], { MONGO_CONNECTION_STRING: remote }, deps)).rejects.toThrow(
      'cosmos-mongo-ustp-cams-dev.mongo.cosmos.azure.us',
    );
    expect(openStore).not.toHaveBeenCalled();
  });

  test.each([[[]], [['delete']]])(
    'should refuse an action other than grant or revoke: %j',
    async (argv) => {
      const { deps, openStore } = fakeDeps();

      await expect(run(argv, { MONGO_CONNECTION_STRING: LOCAL }, deps)).rejects.toThrow(
        'Usage: superuser grant|revoke',
      );
      expect(openStore).not.toHaveBeenCalled();
    },
  );

  test('should grant the Flexion Team account in the cams database by default, then close', async () => {
    const { deps, openStore, grantSuperUser, close } = fakeDeps();

    const outcome = await run(['grant'], { MONGO_CONNECTION_STRING: LOCAL }, deps);

    expect(outcome).toEqual('granted');
    expect(openStore).toHaveBeenCalledWith(LOCAL, 'cams');
    expect(grantSuperUser).toHaveBeenCalledWith(expect.anything(), {
      id: '00uxy2nwugG682IKt697',
      name: 'Flexion Team',
      email: 'doj-ustp-cms-team@flexion.us',
    });
    expect(close).toHaveBeenCalled();
  });

  test('should grant and revoke the user named by SEED_SUPERUSER_*', async () => {
    const { deps, grantSuperUser, revokeSuperUser } = fakeDeps();
    revokeSuperUser.mockResolvedValue({ outcome: 'nothing-to-revoke' });
    const env = {
      MONGO_CONNECTION_STRING: LOCAL,
      SEED_SUPERUSER_ID: '00uabc1234567890abcd',
      SEED_SUPERUSER_NAME: 'Alice Adams',
      SEED_SUPERUSER_EMAIL: 'alice@example.com',
    };

    expect(await run(['grant'], env, deps)).toEqual('granted');
    expect(await run(['revoke'], env, deps)).toEqual('nothing-to-revoke');

    expect(grantSuperUser).toHaveBeenCalledWith(expect.anything(), {
      id: '00uabc1234567890abcd',
      name: 'Alice Adams',
      email: 'alice@example.com',
    });
    expect(revokeSuperUser).toHaveBeenCalledWith(expect.anything(), '00uabc1234567890abcd');
  });

  test('should close the connection when the write fails', async () => {
    const { deps, grantSuperUser, close } = fakeDeps();
    grantSuperUser.mockRejectedValue(new Error('write failed'));

    await expect(run(['grant'], { MONGO_CONNECTION_STRING: LOCAL }, deps)).rejects.toThrow(
      'write failed',
    );
    expect(close).toHaveBeenCalled();
  });

  describe('with --cosmos-host (pipeline mode)', () => {
    const host = 'cosmos-ustp-cams.mongo.cosmos.azure.us';
    const env = {
      MONGO_CONNECTION_STRING: `mongodb://cosmos-ustp-cams:key@${host}:10255/?ssl=true`, // pragma: allowlist secret
      SEED_SUPERUSER_ID: '00uabc1234567890abcd',
      SEED_SUPERUSER_NAME: 'Alice Adams',
    };

    test('should write to the named database on exactly that host', async () => {
      const { deps, openStore, grantSuperUser } = fakeDeps();

      await run(['grant', '--cosmos-host', host, '--database', 'cams-prd'], env, deps);

      expect(openStore).toHaveBeenCalledWith(env.MONGO_CONNECTION_STRING, 'cams-prd');
      expect(grantSuperUser).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: '00uabc1234567890abcd', name: 'Alice Adams' }),
      );
    });

    test('should refuse a connection string for a different host before connecting', async () => {
      const { deps, openStore } = fakeDeps();

      await expect(
        run(
          ['grant', '--cosmos-host', 'other.mongo.cosmos.azure.us', '--database', 'cams'],
          env,
          deps,
        ),
      ).rejects.toThrow(host);
      expect(openStore).not.toHaveBeenCalled();
    });

    test('should require --database', async () => {
      const { deps, openStore } = fakeDeps();

      await expect(run(['grant', '--cosmos-host', host], env, deps)).rejects.toThrow('--database');
      expect(openStore).not.toHaveBeenCalled();
    });

    test('should require SEED_SUPERUSER_ID instead of defaulting to the Flexion Team account', async () => {
      const { deps, openStore } = fakeDeps();

      await expect(
        run(
          ['grant', '--cosmos-host', host, '--database', 'cams'],
          { ...env, SEED_SUPERUSER_ID: ' ' },
          deps,
        ),
      ).rejects.toThrow('SEED_SUPERUSER_ID');
      expect(openStore).not.toHaveBeenCalled();
    });
  });

  test.each([[['grant', '--database']], [['grant', '--unknown', 'x']], [['grant', 'extra']]])(
    'should refuse malformed options: %j',
    async (argv) => {
      const { deps, openStore } = fakeDeps();

      await expect(run(argv, { MONGO_CONNECTION_STRING: LOCAL }, deps)).rejects.toThrow('Usage:');
      expect(openStore).not.toHaveBeenCalled();
    },
  );
});
