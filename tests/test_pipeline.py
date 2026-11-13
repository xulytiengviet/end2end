import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import experiment as e

class PipelineTests(unittest.TestCase):
    def test_base27_exhaustive(self):
        alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ '
        codes = e.codec(alphabet)
        self.assertEqual(len(set(tuple(t) for t in codes)), 27)
        self.assertEqual(e.uncodec(codes), alphabet)
        with self.assertRaises(ValueError):
            e.codec('VIỆT')
        with self.assertRaises(ValueError):
            e.uncodec([[0, 0, 3]])

    def test_gate_rejects_unverified(self):
        self.assertEqual(e.gate(0, False, 99999), 'NOOP')
        self.assertEqual(e.gate(0, True, 999), 'NOOP')
        self.assertEqual(e.gate(55, True, 99999), 'NOOP')

    def test_host_c_bit_exact(self):
        model = json.loads((ROOT/'results/model.json').read_text())
        with tempfile.TemporaryDirectory() as d:
            exe = Path(d)/'infer'
            subprocess.run(['gcc','-std=c11','-O2','-Wall','-Wextra','-Werror',
                            str(ROOT/'firmware/infer.c'),'-o',str(exe)],check=True)
            subprocess.run([str(exe),'--selftest'],check=True)
            for label in range(6):
                pcm = e.synth(label, 20000 + label, profile=label%3)
                raw = Path(d)/'test.raw'
                raw.write_bytes(struct.pack('<'+str(len(pcm))+'h',*pcm))
                result = json.loads(subprocess.check_output([str(exe),'--pcm',str(raw)]))
                v = e.features(pcm)
                self.assertEqual(result['features'], v)
                predicted,_,margin = e.classify(v, model['centroids'])
                self.assertEqual(predicted,label)
                self.assertEqual(result['decision'],e.gate(predicted,e.verify(v,predicted),margin))

if __name__ == '__main__':
    unittest.main()
