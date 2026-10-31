"""Static and executable guards for the Services-only staging entrypoint."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]

class ReusableControllerCandidateTest(unittest.TestCase):
    def test_expected_merge_sha_must_match_admission(self):
        source = yaml.load((ROOT / '.github/workflows/deploy-service-environment.yml').read_text(), Loader=yaml.BaseLoader)
        step = next(x for x in source['jobs']['admit']['steps'] if x.get('id') == 'admission')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'scripts').mkdir()
            (root / 'scripts/github_environment_admission.py').write_text(
                'import json,os\nprint(json.dumps({"source_sha": os.environ["ACTUAL"]}))\n')
            def run(expected):
                env = dict(os.environ, SOURCE_REPOSITORY='open-hax/knoxx', PR_NUMBER='398',
                           ENVIRONMENT='staging', EXPECTED_SOURCE_SHA=expected, ACTUAL='a' * 40)
                return subprocess.run(['bash', '-euo', 'pipefail', '-c', step['run']], cwd=root,
                                      env=env, capture_output=True, text=True, check=False)
            self.assertEqual(0, run('a' * 40).returncode)
            self.assertNotEqual(0, run('b' * 40).returncode)
            self.assertNotEqual(0, run('main').returncode)
            self.assertEqual(0, run('').returncode, 'legacy callers remain compatible')
        checkout = next(x for x in source['jobs']['build']['steps'] if x.get('with', {}).get('path') == 'source')
        self.assertEqual('${{ inputs.source_repository || github.repository }}', checkout['with']['repository'])

if __name__ == '__main__':
    unittest.main()
