"""Static and executable guards for the Services-only staging entrypoint."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]

class StageKnoxxWorkflowTest(unittest.TestCase):
    def setUp(self):
        self.workflow = yaml.load((ROOT / '.github/workflows/stage-knoxx.yml').read_text(), Loader=yaml.BaseLoader)

    def run_guard(self, **changes):
        env = dict(os.environ, REPOSITORY='open-hax/services', REF='refs/heads/main',
                   PR_NUMBER='398', SOURCE_SHA='a' * 40)
        env.update(changes)
        return subprocess.run(['bash', '-euo', 'pipefail', '-c',
                               self.workflow['jobs']['validate']['steps'][0]['run']],
                              env=env, capture_output=True, text=True, check=False)

    def test_only_explicit_upstream_main_immutable_candidate_is_admitted(self):
        self.assertEqual(0, self.run_guard().returncode)
        for case in ({'REPOSITORY': 'riatzukiza/services'}, {'REF': 'refs/heads/feature'},
                     {'PR_NUMBER': '0'}, {'PR_NUMBER': '1;false'}, {'SOURCE_SHA': 'main'},
                     {'SOURCE_SHA': 'A' * 40}):
            with self.subTest(case=case):
                self.assertNotEqual(0, self.run_guard(**case).returncode)

    def test_reusable_controller_is_staging_only_and_receives_exact_source(self):
        stage = self.workflow['jobs']['stage']
        self.assertEqual('validate', stage['needs'])
        self.assertEqual('./.github/workflows/deploy-service-environment.yml', stage['uses'])
        self.assertEqual('knoxx', stage['with']['service'])
        self.assertEqual('staging', stage['with']['environment'])
        self.assertEqual('open-hax/knoxx', stage['with']['source_repository'])
        self.assertEqual('${{ inputs.source_sha }}', stage['with']['expected_source_sha'])
        self.assertNotIn('secrets', stage)

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
