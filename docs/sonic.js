'use strict';
// Reference lexicon experiment, NOT audio recognition. Evidence is loaded from CI-produced JSON.
(() => {
 const el = id => document.getElementById(id);
 const source = '../results/sonic-proof.json';
 const statuses = {PASS:'ĐÃ KIỂM THỬ',REFUTED:'PHẢN VÍ DỤ',UNTESTED:'CHƯA KIỂM CHỨNG',UNMEASURED:'CHƯA ĐO'};
 const ids=[['base27_bijection','Base27 ↔ 3 trit'],['finite_lexicon_roundtrip','Đảo ngược trên 6 lệnh'],['cvnss_global_bijection','Song ánh CVNSS toàn miền'],['formal_C1','C1: Âm vị ↔ mã'],['formal_C2_global','C2: Unicode ↔ CVNSS toàn miền'],['formal_C2_restricted','C2: Miền lệnh giới hạn'],['formal_C3','C3: Đường hành động qua âm vị'],['formal_C4','C4: Tương thích toàn trình'],['real_audio_wer','WER tiếng Việt thật'],['hardware_esp32s3_latency_ms','Độ trễ ESP32-S3']];
 function statusTable(obj) {
   const tbody=el('sonic-evidence-body');tbody.replaceChildren();
   for (const [key,label] of ids) {
     const record=obj.results[key],row=document.createElement('tr');
     const name=document.createElement('th');name.scope='row';name.textContent=label;
     const value=document.createElement('td');value.textContent=statuses[record?.status]||'KHÔNG CÓ DỮ LIỆU';
     value.className='sonic-status '+(record?.status||'unknown').toLowerCase();
     row.append(name,value);tbody.append(row);
   }
   el('sonic-scope').textContent='Báo cáo: '+obj.schema_version+' · converter '+obj.provenance.converter_version+' · SHA256 '+obj.provenance.converter_sha256.slice(0,16)+'…';
 }
 function parseSonic() {
   const c=window.CVNSSConverter;
   if(!c){el('sonic-output').textContent='Không tải được CVNSS4.0 converter. Hãy dùng HTTP server và kiểm tra đường dẫn.';return;}
   const input=el('sonic-input').value.trim().normalize('NFC');
   if(!input){el('sonic-output').textContent='Nhập một cụm tiếng Việt.';return;}
   const encoded=c.fromCqn(input).cvss;
   const decoded=c.fromCvss(encoded).cqn;
   const candidates=encoded.split(' ').map(s=>({code:s,options:c.candidatesForWord(s)}));
   const chars=[...encoded.toUpperCase()];
   const unsupported=chars.some(x=>x!==' '&&!(x>='A'&&x<='Z'));
   const trits=unsupported?null:chars.map(x=>{
      const value=x===' '?26:x.charCodeAt(0)-65;
      return [Math.floor(value/9),Math.floor(value/3)%3,value%3].join('');
   });
   el('sonic-output').textContent=JSON.stringify({input,code:encoded,decoded_default:decoded,roundtrip_exact:input===decoded,candidate_sets:candidates,base27_trits:trits,notes:'Mã CVNSS4.0 là chính tả; không phải IPA / âm thanh / dự đoán robot.'},null,2);
 }
 el('sonic-run').addEventListener('click',parseSonic);
 el('sonic-example').addEventListener('click',()=>{el('sonic-input').value='ề';parseSonic()});
 el('sonic-input').addEventListener('keydown',e=>{if(e.key==='Enter')parseSonic()});
 fetch(source,{cache:'no-store'}).then(res=>{if(!res.ok)throw Error('HTTP '+res.status);return res.json()})
   .then(statusTable).catch(err=>{el('sonic-scope').textContent='Không tải được báo cáo xác minh: '+err.message+' · Chạy node scripts/verify_sonic.js';});
 parseSonic();
})();
