#!/usr/bin/env node
'use strict';
/* Generate a CVNSS4.0 lookup lexicon from the audit-safe upstream converter.
   CVNSS is orthographic, NOT a dialect/IPA transcription. */
const fs=require('fs'), path=require('path');
const codec=require('../vendor/cvnss-converter.js');
const commands=[
 {id:'STOP',text:'dừng',action:{kind:'stop'}},
 {id:'FORWARD',text:'tiến',action:{kind:'move',direction:'forward'}},
 {id:'BACK',text:'lùi',action:{kind:'move',direction:'back'}},
 {id:'LEFT',text:'trái',action:{kind:'turn',direction:'left'}},
 {id:'RIGHT',text:'phải',action:{kind:'turn',direction:'right'}},
 {id:'LIGHT',text:'bật đèn',action:{kind:'light',value:true}},
];
if(!codec.VERSION||!codec.fromCqn||!codec.fromCvss)throw Error('Missing upstream converter API');
const entries=commands.map(cmd=>{
 const cvnss=codec.fromCqn(cmd.text).cvss;
 if(typeof cvnss!=='string'||!/^[a-z ]+$/.test(cvnss))throw Error('Unsupported CVNSS output for '+cmd.id+': '+cvnss);
 const decoded_default=codec.fromCvss(cvnss).cqn;
 return {...cmd,cvnss,decoded_default,ambiguous:decoded_default!==cmd.text};
});
if(new Set(entries.map(e=>e.cvnss)).size!==entries.length)throw Error('Command aliases collide; refuse to export');
const json={kind:'verified_lookup_lexicon_not_dialect_or_phonetic_model',converter_version:codec.VERSION,
 original_authors:'Kiều Trường Lâm; Trần Tư Bình',
 notes:'Round-trip ambiguity is recorded, not silently treated as lossless.',
 entries};
const out=path.join(__dirname,'../data/lexicon.json');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(json,null,2)+'\n');
console.log(JSON.stringify({version:json.converter_version,entries},null,2));
