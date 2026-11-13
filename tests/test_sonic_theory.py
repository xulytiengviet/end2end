"""Scientific scope guards: never turn an untested theory into an asserted result."""
import json
from pathlib import Path
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]
class SonicTheoryTests(unittest.TestCase):
    def test_machine_readable_counterexamples_and_provenance(self):
        subprocess.run(['node','scripts/build_lexicon.js'],cwd=ROOT,check=True,capture_output=True)
        subprocess.run(['node','scripts/verify_sonic.js'],cwd=ROOT,check=True,capture_output=True)
        doc=json.loads((ROOT/'results/sonic-proof.json').read_text(encoding='utf-8'))
        r=doc['results']
        self.assertEqual(r['base27_bijection']['status'],'PASS')
        self.assertEqual(r['cvnss_global_bijection']['status'],'REFUTED')
        self.assertEqual(r['cvnss_global_bijection']['counterexample']['same_code'],'ed')
        self.assertEqual(r['formal_C2_restricted']['cases'],6)
        for key in ('formal_C1','formal_C3','formal_C4'):
            self.assertEqual(r[key]['status'],'UNTESTED')
        self.assertIsNone(r['real_audio_wer']['value'])
        self.assertIsNone(r['hardware_esp32s3_latency_ms']['value'])

    def test_verification_script_is_byte_reproducible(self):
        def run():
            subprocess.run(['node','scripts/verify_sonic.js'],cwd=ROOT,check=True,capture_output=True)
            return (ROOT/'results/sonic-proof.json').read_bytes()
        self.assertEqual(run(),run())

if __name__=='__main__': unittest.main()
