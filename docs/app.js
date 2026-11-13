'use strict';
// Browser draws SYNTHETIC FEATURE vectors. This is not live ASR and does not run the C firmware.
const $=id=>document.getElementById(id);
const names=['STOP','FORWARD','BACK','LEFT','RIGHT','LIGHT','UNKNOWN'];
const signatures=[[0,0,1,1,0,0,1,1],[1,2,3,4,1,2,3,4],[4,3,2,1,4,3,2,1],[1,3,1,3,1,3,1,3],[3,1,3,1,3,1,3,1],[5,6,7,5,6,7,5,6]];
let centroids=null,iteration=0;
const base27=s=>[...s].map(c=>c===' '?26:c.charCodeAt(0)-65);
const trits=n=>[Math.floor(n/9),Math.floor(n/3)%3,n%3].join('');
function sample(label,noise){
  let seed=(20261113+iteration*1337)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const target=label===6?Array.from({length:8},()=>Math.floor(random()*8)):signatures[label];
  const vec=[];
  for(let t=0;t<8;t++){
    const row=[];
    for(let b=0;b<8;b++)row.push(Math.max(0,(target[t]===b?215:8)+random()*noise*3.3));
    const mx=Math.max(...row);
    for(const p of row)vec.push(Math.floor(255*p/mx));
  }
  return vec;
}
function predict(v){
  if(!centroids)return {prediction:-1,verified:false,margin:0,decision:'UNAVAILABLE'};
  const dist=centroids.map(row=>row.reduce((sum,x,j)=>sum+(x-v[j])**2,0));
  const order=dist.map((d,i)=>[d,i]).sort((a,b)=>a[0]-b[0]);
  const p=order[0][1],margin=order[1][0]-order[0][0];
  const matches=signatures[p].reduce((total,wanted,t)=>{
    let observed=0;
    for(let b=1;b<8;b++)if(v[t*8+b]>v[t*8+observed])observed=b;
    return total+(observed===wanted?1:0);
  },0);
  const verified=matches>=7;
  return {prediction:p,verified,margin,decision:(verified&&margin>=1000)?names[p]:'NOOP'};
}
function render(v){
  const cvs=$('spect'),ctx=cvs.getContext('2d'),w=cvs.width,h=cvs.height,pad=44;
  ctx.fillStyle='#081018';ctx.fillRect(0,0,w,h);
  const dx=(w-2*pad)/8,dy=(h-2*pad)/8;
  for(let t=0;t<8;t++)for(let b=0;b<8;b++){
    const energy=v[t*8+b]/255;
    ctx.fillStyle='hsl('+(200-126*energy)+','+(55+20*energy)+'%,'+(12+60*energy)+'%)';
    ctx.fillRect(pad+t*dx+1,pad+(7-b)*dy+1,dx-2,dy-2);
  }
  ctx.font='15px monospace';ctx.fillStyle='#a3beca';
  ctx.fillText('TIME →',w-125,h-10);
  ctx.save();ctx.translate(18,h/2);ctx.rotate(-Math.PI/2);ctx.fillText('FREQUENCY →',-64,0);ctx.restore();
}
function simulate(){
  iteration++;
  const label=Number($('command').value),noise=Number($('noise').value);
  const v=sample(label,noise),a=predict(v);
  render(v);
  $('pred').textContent=a.prediction>=0?names[a.prediction]:'MISSING MODEL';
  $('ref').textContent=a.verified?'SIGNATURE AGREES':'UNVERIFIED';
  $('gate').textContent=a.decision;
  $('gate').style.color=a.decision==='NOOP'?'#ff867b':'#d5fb64';
  const ascii=a.prediction>=0?names[a.prediction]:'STOP';
  const codes=base27(ascii);
  $('base').textContent=codes.join(' ');
  $('trits').textContent=codes.map(trits).join(' ');
  $('confidence').textContent='Margin: '+a.margin.toLocaleString('vi-VN');
}
$('run').addEventListener('click',simulate);
$('reset').addEventListener('click',()=>{$('noise').value=15;$('command').value='0';$('noiseValue').textContent='15%';simulate();});
$('noise').addEventListener('input',()=>$('noiseValue').textContent=$('noise').value+'%');
Promise.all([
  fetch('../results/model.json').then(r=>{if(!r.ok)throw Error('model');return r.json()}),
  fetch('../results/report.json').then(r=>{if(!r.ok)throw Error('report');return r.json()})
]).then(([model,report])=>{
  centroids=model.centroids;
  $('modelStatus').textContent='SYNTHETIC CENTROID / 64 FEATURES';
  $('samples').textContent=report.test_samples.toLocaleString('vi-VN');
  $('seed').textContent='Seed '+report.seed+' / sóng âm tổng hợp';
  $('report').textContent=JSON.stringify({
    kind:report.data_type,known:report.known_count,unknown:report.unknown_count,
    direct_accuracy:report.direct_classification_accuracy,
    hybrid_correct_accept:report.hybrid_correct_accept_rate,
    unknown_false_accept:report.hybrid_false_accept_unknown_rate
  },null,2);
  simulate();
}).catch(()=>{
  $('modelStatus').textContent='Không đọc được model.json';
  $('report').textContent='Hãy chạy python experiment.py và mở trang qua python -m http.server 8000';
  simulate();
});
