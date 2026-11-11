#!/usr/bin/env python3
"""Check Axxium seed admission and the private staging Compose environment."""
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SEED = ROOT / 'contracts/axxium/identity/foresight-tree.edn'
COMPOSE = ROOT / 'digitalocean/environments/axxium-owner-staging.compose.yaml'


class SeedAdmissionTest(unittest.TestCase):
    def test_mutations(self):
        """Reject malformed seeds and secret markers without rejecting ordinary names."""
        original = SEED.read_text()
        cases = {
            'valid': (original, True),
            'ordinary text containing sk prefix': (original + '\n;; task-runner and risk-assessment\n', True),
            'trailing form': (original + '\n{}\n', False),
            'duplicate root': (original.replace(':id "err:grokbots"', ':id "err"', 1), False),
            'duplicate child': (original.replace(':id "err:grokbots:grok-bot"', ':id "err:grokbots"', 1), False),
            'malformed referenced policy': (original.replace(':policies {:forks {', ':policies {:forks nil :unused {', 1), False),
            'malformed inline policy': (original.replace(':policy/repos #{"*"}', ':policy/repos []', 1), False),
            'fine-grained token in comment': (original + '\n;; github_' + 'pat_synthetic\n', False),
            'case-insensitive token': (original + '\n;; GITHUB_' + 'PAT_synthetic\n', False),
            'OpenAI-style token in comment': (original + '\n;; OPENAI_API_KEY=sk' + '-proj-synthetic\n', False),
        }
        with tempfile.TemporaryDirectory() as tmp:
            dest = pathlib.Path(tmp)
            shutil.copytree(ROOT / 'contracts/knoxx', dest / 'contracts/knoxx')
            (dest / 'contracts/axxium/identity').mkdir(parents=True)
            seed = dest / 'contracts/axxium/identity/test.edn'
            for name, (content, valid) in cases.items():
                with self.subTest(name=name):
                    seed.write_text(content)
                    result = subprocess.run(['clojure', '-M', str(ROOT / 'scripts/check-edn-contracts.clj')], cwd=dest, capture_output=True, text=True)
                    self.assertEqual(result.returncode == 0, valid, result.stderr)

    def test_compose_owner_binding_before_and_after_sign_in(self):
        """Render the first boot and the verified owner configuration from the slot file."""
        owner = {
            'AXXIUM_IDENTITY_ROOT_OPERATOR_ACTOR_ID': 'actor_00000000-0000-4000-8000-000000000001',
            'AXXIUM_IDENTITY_ROOT_DID': 'did:web:127.0.0.1:18874:actors:err',
        }
        required = {'AXXIUM_IMAGE': 'axxium:test', 'DB_PASSWORD': 'synthetic-only'}
        env = os.environ.copy()
        for key in required | owner:
            env.pop(key, None)

        with tempfile.TemporaryDirectory() as tmp:
            env_file = pathlib.Path(tmp) / '.env'
            for binding in (dict.fromkeys(owner), owner):
                with self.subTest(bound=binding == owner):
                    env_file.write_text(''.join(
                        f'{key}={value}\n' for key, value in (required | binding).items()
                        if value is not None
                    ))
                    result = subprocess.run(
                        ['docker', 'compose', '--env-file', str(env_file), '-f', str(COMPOSE),
                         'config', '--format', 'json'],
                        env=env, cwd=tmp, capture_output=True, text=True, check=True,
                    )
                    settings = json.loads(result.stdout)['services']['axxium']['environment']
                    self.assertEqual({key: settings.get(key) for key in owner}, binding)


if __name__ == '__main__':
    unittest.main()
