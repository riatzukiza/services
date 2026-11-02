#!/usr/bin/env python3
"""Exercise Axxium seed admission with synthetic invalid inputs."""
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SEED = ROOT / 'contracts/axxium/identity/foresight-tree.edn'

class SeedAdmissionTest(unittest.TestCase):
    def test_mutations(self):
        original = SEED.read_text()
        cases = {
            'valid': (original, True),
            'trailing form': (original + '\n{}\n', False),
            'duplicate root': (original.replace(':id "err:grokbots"', ':id "err"', 1), False),
            'duplicate child': (original.replace(':id "err:grokbots:grok-bot"', ':id "err:grokbots"', 1), False),
            'malformed referenced policy': (original.replace(':policies {:forks {', ':policies {:forks nil :unused {', 1), False),
            'malformed inline policy': (original.replace(':policy/repos #{"*"}', ':policy/repos []', 1), False),
            'fine-grained token in comment': (original + '\n;; github_' + 'pat_synthetic\n', False),
            'case-insensitive token': (original + '\n;; GITHUB_' + 'PAT_synthetic\n', False),
        }
        with tempfile.TemporaryDirectory() as tmp:
            dest = pathlib.Path(tmp)
            shutil.copytree(ROOT / 'contracts/knoxx', dest / 'contracts/knoxx')
            (dest / 'contracts/axxium/identity').mkdir(parents=True)
            seed = dest / 'contracts/axxium/identity/test.edn'
            for name, (content, valid) in cases.items():
                with self.subTest(name=name):
                    seed.write_text(content)
                    result = subprocess.run(['clojure', str(ROOT / 'scripts/check-edn-contracts.clj')], cwd=dest, capture_output=True, text=True)
                    self.assertEqual(result.returncode == 0, valid, result.stderr)

if __name__ == '__main__':
    unittest.main()
