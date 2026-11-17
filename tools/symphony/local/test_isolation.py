"""Offline Git fixtures only; no agent, remote service or existing workspace."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
BASE = 'sprint/one-city-two-futures-20261111'


def run(*args, cwd, env=None, check=True):
    result = subprocess.run(args, cwd=cwd, env=env, check=False,
                            capture_output=True, text=True)
    if check and result.returncode:
        raise AssertionError(f"Fixture command failed: {args!r}\n{result.stderr}")
    return result


class IsolationTest(unittest.TestCase):
    def test_clone_fetch_merge_commit_and_refusal(self):
        with tempfile.TemporaryDirectory(prefix='symphony-fixture-') as root:
            root = Path(root)
            source = root / 'source'
            source.mkdir()
            env = dict(os.environ, GIT_CONFIG_NOSYSTEM='1',
                       GIT_CONFIG_GLOBAL='/dev/null', GIT_AUTHOR_NAME='Fixture',
                       GIT_AUTHOR_EMAIL='fixture@example.invalid',
                       GIT_COMMITTER_NAME='Fixture',
                       GIT_COMMITTER_EMAIL='fixture@example.invalid')
            run('git', 'init', '-b', BASE, cwd=source, env=env)
            (source / 'example').write_text('base\n')
            run('git', 'add', '.', cwd=source, env=env)
            run('git', 'commit', '-m', 'fixture', cwd=source, env=env)
            clone = root / 'PILOT-1'
            clone.mkdir()
            env.update(HBL_REPO_URL=str(source), HBL_MIN_FREE_GIB='0')
            hook = str(HERE / 'isolated-checkout.sh')
            check = str(HERE / 'check-isolation.sh')
            run('sh', hook, cwd=clone, env=env)
            run('sh', check, cwd=clone, env=env)
            def git_in_workspace(*args):
                command = ['git', *args]
                return run(*command, cwd=clone, env=env)

            git_in_workspace('fetch', 'origin', BASE)
            git_in_workspace('merge', '--no-edit', 'FETCH_HEAD')
            (clone / 'example').write_text('implementation\n')
            git_in_workspace('add', '.')
            git_in_workspace('commit', '-m', 'implementation fixture')
            self.assertTrue((clone / '.git/FETCH_HEAD').is_file())
            self.assertFalse((clone / '.git/objects/info/alternates').exists())
            self.assertNotEqual(run('git', 'rev-parse', 'HEAD', cwd=clone, env=env).stdout,
                                run('git', 'rev-parse', 'HEAD', cwd=source, env=env).stdout)
            self.assertNotEqual(run('sh', hook, cwd=clone, env=env, check=False).returncode, 0)
            (clone / '.git/objects/info/alternates').write_text('/outside/objects\n')
            self.assertNotEqual(run('sh', check, cwd=clone, env=env, check=False).returncode, 0)
            shared = root / 'shared'
            shared.mkdir()
            (shared / '.git').write_text('gitdir: /outside/worktrees/shared\n')
            self.assertNotEqual(run('sh', check, cwd=shared, env=env, check=False).returncode, 0)


if __name__ == '__main__':
    unittest.main()
