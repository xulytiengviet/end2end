#!/usr/bin/env node
'use strict';
// Deterministic, auditable finite-domain checks. NEVER interpret as acoustic or TTS validation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const converterPath = path.join(root, 'vendor/cvnss-converter.js');
const lexiconPath = path.join(root, 'data/lexicon.json');
const converter = require(converterPath);
const lexicon = JSON.parse(fs.readFileSync(lexiconPath, 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function assert(condition, message) { if (!condition) throw new Error(message); }
function encode27(ch) { const v = ch === ' ' ? 26 : ch.charCodeAt(0)-65; assert(v>=0 && v<27, 'Base27 domain'); return [Math.floor(v/9), Math.floor(v/3)%3, v%3]; }
function decode27(a) { assert(a.length===3 && a.every(t=>Number.isInteger(t)&&t>=0&&t<=2), 'trit range'); const v=9*a[0]+3*a[1]+a[2]; return v===26?' ':String.fromCharCode(65+v); }
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
assert(alphabet.length===27, 'alphabet size');
const triples=alphabet.split('').map(encode27);
assert(new Set(triples.map(x=>x.join(''))).size===27, 'triples are unique');
assert(triples.map(decode27).join('')===alphabet, '27 round trips');
assert(converter.VERSION===lexicon.converter_version,'converter version drift');
assert(lexicon.entries.length===6,'expected 6 command entries');
const codes=new Set();
for(const entry of lexicon.entries){
 const code=converter.fromCqn(entry.text).cvss;
 assert(code===entry.cvnss, `lexicon drift ${entry.id}`);
 assert(/^[a-z ]+$/.test(code), `non-Base27 ${entry.id}`);
 assert(converter.fromCvss(code).cqn===entry.text, `finite whitelist inverse failed ${entry.id}`);
 assert(!codes.has(code),`finite whitelist collision ${entry.id}`); codes.add(code);
}
const adversarial=[['ề','oet','ed'],['ẽ','oec','es'],['ồ','oat','od'],['ộ','oap','of'],['õ','oac','os']];
for(const [a,b,s] of adversarial){
 assert(converter.fromCqn(a).cvss===s, `${a} mismatch`);
 assert(converter.fromCqn(b).cvss===s, `${b} mismatch`);
 const candidates=converter.candidatesForWord(s);
 assert(candidates.includes(a)&&candidates.includes(b),`${s} candidates lost`);
}
// Repeated calls verify reproducible computation, NOT 10,000 independent linguistic examples.
let repeated=0;
for(let k=0;k<10000;k++){
 const e=lexicon.entries[k%lexicon.entries.length];
 assert(converter.fromCqn(e.text).cvss===e.cvnss,'nondeterministic encoder');
 repeated++;
}
const report={
 schema_version:'sonic-proof-v0.2', study:'CVNSS4.0-Sonic / finite-domain formal checks',
 evidence_type:'reproducible_software_checks_not_natural_speech', seed:20261113,
 provenance:{converter_version:converter.VERSION,converter_sha256:sha256(converterPath),lexicon_sha256:sha256(lexiconPath),verification_script_sha256:sha256(__filename)},
 results:{base27_bijection:{status:'PASS',cases:27,scope:'A-Z plus SPACE only'},
 finite_lexicon_roundtrip:{status:'PASS',cases:lexicon.entries.length,scope:'six authorised Unicode labels only'},
 deterministic_repeats:{status:'PASS',calls:repeated,distinct_inputs:lexicon.entries.length},
 cvnss_global_bijection:{status:'REFUTED',counterexample:{orthographies:['ề','oet'],same_code:'ed'},other_collisions:adversarial.slice(1).map(x=>({orthographies:x.slice(0,2),same_code:x[2]}))},
 cvnss_ipa_bijection:{status:'UNTESTED',reason:'No complete regional phonology/G2P model or verified inverse'},
 formal_C1:{status:'UNTESTED'},formal_C2_global:{status:'REFUTED',counterexample:'ề and oet both encode to ed'},
 formal_C2_restricted:{status:'PASS',cases:lexicon.entries.length},
 formal_C3:{status:'UNTESTED',reason:'No validated phonological map D and independent R'},
 formal_C4:{status:'UNTESTED',reason:'No validated phonological map D and independent R'},
 real_audio_wer:{status:'UNMEASURED',value:null},hardware_esp32s3_latency_ms:{status:'UNMEASURED',value:null},
 robot_safety_certification:{status:'UNMEASURED',value:null}}};
const output=path.join(root,'results/sonic-proof.json');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({status:'PASS_WITH_REFUTATION',outputs:output,base27:27,whitelist:6,collisions:adversarial.length,repeats:10000}));
