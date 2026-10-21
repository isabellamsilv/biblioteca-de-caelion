/*
 * QUANDO O CAMPO RESPONDE — versão narrada
 * Sintaxe de Presença · estudo 02b
 *
 * Filme procedural criado em código. A voz é a gravação aprovada por Isa,
 * gerada no ElevenLabs com “Caelion - remix best”.
 *
 * A imagem evita uma anatomia de fios: corpos, extensões e ligações são
 * membranas translúcidas, tecidos largos e pressões luminosas.
 */
'use strict';

const {createCanvas}=require('@napi-rs/canvas');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');

const W=720,H=1280;
const DRAFT=process.argv.includes('--draft');
const FPS=DRAFT?12:24;
const DURATION=90;
const FRAMES=Math.round(DURATION*FPS);
const SR=48000,TAU=Math.PI*2,VOICE_DELAY=1.6;
const ROOT=__dirname;
const OUT=path.join(ROOT,'output');
const REVIEW=path.join(ROOT,'review','narrated');
const VOICE=process.env.VOICE_FILE || path.join(ROOT,'assets','narration.mp3');

const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,u)=>a+(b-a)*u;
const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};
const smoother=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*u*(u*(u*6-15)+10);};
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453123;return x-Math.floor(x);};
const P=(x,y)=>({x,y});
const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;

const C={
  pearl:[187,220,226],
  blue:[133,190,216],
  gold:[231,185,128],
  rose:[221,151,157],
  green:[151,205,184],
  violet:[188,175,218],
  ivory:[236,223,193]
};

// The spoken phrases begin 1.6 seconds after the visual field appears.
const T={
  first:VOICE_DELAY,
  ignite:4.01,
  attention:6.92,
  question:8.13,
  presence:9.36,
  extend:12.49,
  words:14.88,
  deadEnds:17.49,
  others:20.90,
  reaching:27.33,
  deeper:33.08,
  answer:37.54,
  meets:40.44,
  returns:44.04,
  memory:45.52,
  choice:47.22,
  nextWord:49.51,
  form:53.18,
  livingField:56.34,
  lights:60.93,
  extensions:63.97,
  signals:65.51,
  rhythms:66.99,
  continuity:69.35,
  changed:73.11,
  language:76.98,
  distance:79.78,
  hands:85.27,
  voiceEnd:87.52
};

function cubic(a,b,c,d,u){
  const v=1-u;
  return P(
    v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,
    v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y
  );
}

function makePath(a,b,c,d,n=100,seed=0,wobble=0){
  const pts=[];
  for(let i=0;i<=n;i++){
    const u=i/n,p=cubic(a,b,c,d,u),q=cubic(a,b,c,d,clamp(u+.006));
    const dx=q.x-p.x,dy=q.y-p.y,l=Math.max(.001,Math.hypot(dx,dy));
    const wave=wobble*Math.sin(TAU*(u*(1.12+hash(seed)*.82)+hash(seed+8)))*Math.sin(Math.PI*u);
    pts.push(P(p.x-dy/l*wave,p.y+dx/l*wave));
  }
  const normals=pts.map((p,i)=>{
    const a0=pts[Math.max(0,i-1)],b0=pts[Math.min(pts.length-1,i+1)];
    const dx=b0.x-a0.x,dy=b0.y-a0.y,l=Math.max(.001,Math.hypot(dx,dy));
    return P(-dy/l,dx/l);
  });
  return {pts,normals,seed};
}

function at(path,u){
  const q=clamp(u)*(path.pts.length-1),i=Math.floor(q),f=q-i;
  const a=path.pts[i],b=path.pts[Math.min(i+1,path.pts.length-1)];
  return P(mix(a.x,b.x,f),mix(a.y,b.y,f));
}

function trace(path,reveal=1){
  const n=Math.max(1,Math.floor(clamp(reveal)*(path.pts.length-1)));
  ctx.beginPath();ctx.moveTo(path.pts[0].x,path.pts[0].y);
  for(let i=1;i<=n;i++)ctx.lineTo(path.pts[i].x,path.pts[i].y);
  return n;
}

function radial(x,y,r,color,alpha,inner=.18){
  if(alpha<=0||r<=0)return;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,rgba(color,alpha));
  g.addColorStop(inner,rgba(color,alpha*.64));
  g.addColorStop(1,rgba(color,0));
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}

function ribbon(path,reveal,color,width,alpha,t,opts={}){
  reveal=clamp(reveal);if(reveal<=0||alpha<=0)return;
  const n=Math.max(2,Math.floor(reveal*(path.pts.length-1)));
  const tipOpen=reveal<.995;
  ctx.save();ctx.globalCompositeOperation='screen';

  const centers=[];
  for(let i=0;i<=n;i++){
    const u=i/(path.pts.length-1),p=path.pts[i],nn=path.normals[i];
    const motion=opts.motion===false?0:(4.0+width*.078)*Math.sin(Math.PI*u)*Math.sin(t*.42+u*TAU*1.18+path.seed*.17);
    centers.push(P(p.x+nn.x*motion,p.y+nn.y*motion));
  }
  const traceCenters=()=>{
    ctx.beginPath();ctx.moveTo(centers[0].x,centers[0].y);
    for(let i=1;i<centers.length;i++)ctx.lineTo(centers[i].x,centers[i].y);
  };

  // A broad haze makes the connection read as material, never as wire.
  traceCenters();
  ctx.strokeStyle=rgba(color,alpha*(opts.haze??.22));
  ctx.lineWidth=width*2.35;ctx.lineCap='round';ctx.lineJoin='round';
  if(opts.glow!==false){ctx.shadowColor=rgba(color,alpha*.36);ctx.shadowBlur=width*.92;}
  ctx.stroke();ctx.shadowBlur=0;

  const left=[],right=[];
  for(let i=0;i<=n;i++){
    const u=i/Math.max(1,n),globalU=i/(path.pts.length-1);
    const p=centers[i],nn=path.normals[i];
    const start=.55+.45*smooth(0,.16,u);
    const end=tipOpen?Math.pow(Math.max(0,1-u),.34):(.58+.42*smooth(1,.78,u));
    const organic=.91+.10*Math.sin(globalU*TAU*2.1+t*.22+path.seed*.31)+.055*Math.sin(globalU*TAU*5.2-path.seed);
    const w=width*start*end*organic*.5;
    left.push(P(p.x+nn.x*w,p.y+nn.y*w));
    right.push(P(p.x-nn.x*w,p.y-nn.y*w));
  }
  ctx.beginPath();ctx.moveTo(left[0].x,left[0].y);
  for(let i=1;i<left.length;i++)ctx.lineTo(left[i].x,left[i].y);
  for(let i=right.length-1;i>=0;i--)ctx.lineTo(right[i].x,right[i].y);
  ctx.closePath();
  const a=centers[0],b=centers[n];
  const g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
  g.addColorStop(0,rgba(color,alpha*.68));
  g.addColorStop(.46,rgba(color,alpha));
  g.addColorStop(1,rgba(color,alpha*(tipOpen?.74:.62)));
  ctx.fillStyle=g;ctx.fill();

  // One broken current is suspended inside the tissue. It never defines its silhouette.
  if(opts.current!==false){
    traceCenters();ctx.setLineDash([1.4,8.5]);ctx.lineDashOffset=-(t*7+path.seed);
    ctx.strokeStyle=rgba(C.ivory,alpha*.43);ctx.lineWidth=Math.max(.65,width*.075);ctx.stroke();ctx.setLineDash([]);
  }
  if(tipOpen){
    const p=centers[n],tip=width*(.8+.15*Math.sin(t*2.1+path.seed));
    radial(p.x,p.y,tip*2.4,color,alpha*.58);
    radial(p.x,p.y,tip*.82,C.ivory,alpha*.72);
  }
  ctx.restore();
}

function packet(path,u,color,intensity=1,size=14){
  if(u<=0||u>=1||intensity<=0)return;
  const p=at(path,u);
  ctx.save();ctx.globalCompositeOperation='screen';
  radial(p.x,p.y,size*2.25,color,.28*intensity);
  radial(p.x,p.y,size*.72,C.ivory,.78*intensity,.1);
  ctx.restore();
}

function softFlow(path,reveal,color,width,alpha,t){
  reveal=clamp(reveal);if(reveal<=0||alpha<=0)return;
  ctx.save();ctx.globalCompositeOperation='screen';
  trace(path,reveal);ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=rgba(color,alpha*.34);ctx.lineWidth=width;
  ctx.shadowColor=rgba(color,alpha*.55);ctx.shadowBlur=width*1.18;ctx.stroke();ctx.shadowBlur=0;
  trace(path,reveal);ctx.strokeStyle=rgba(C.ivory,alpha*.20);ctx.lineWidth=Math.max(1.2,width*.22);ctx.stroke();
  if(reveal<.995){const p=at(path,reveal);radial(p.x,p.y,width*1.25,color,alpha*.58);}
  ctx.restore();
}

const NODES=[
  {x:245,y:635,wake:T.ignite,seed:17,color:C.gold,r:47},
  {x:166,y:425,wake:T.attention,seed:31,color:C.pearl,r:41},
  {x:395,y:422,wake:T.question,seed:53,color:C.violet,r:43},
  {x:332,y:790,wake:T.presence,seed:79,color:C.rose,r:47},
  {x:508,y:645,wake:T.others,seed:107,color:C.green,r:53},
  {x:500,y:925,wake:T.others+2.1,seed:137,color:C.blue,r:46}
];

function nodePosition(node,t,index){
  const shared=smoother(T.continuity,T.continuity+3.1,t);
  const ownX=Math.sin(t*(.145+.014*index)+node.seed)*5.1;
  const ownY=Math.cos(t*(.118+.011*index)+node.seed*.7)*6.2;
  const towardX=(366-node.x)*.045*shared;
  const towardY=(660-node.y)*.035*shared;
  return P(node.x+ownX+towardX,node.y+ownY+towardY);
}

function body(node,index,t,scale=1,alpha=1){
  const birth=smoother(node.wake,node.wake+1.7,t);
  if(birth<=0||alpha<=0)return;
  const p=nodePosition(node,t,index);
  const coherence=smoother(T.continuity,T.continuity+3.0,t);
  const own=t*(.45+.055*index)+node.seed*.17;
  const shared=t*.56+.7;
  const phase=mix(own,shared,coherence*.72);
  const breath=.88+.12*Math.sin(phase);
  const hitTimes=[48.15,46.10,47.25,49.35,44.55,50.65];
  const hit=Math.exp(-Math.pow((t-hitTimes[index])/.62,2));
  const r=node.r*birth*scale*breath*(1+.16*hit);

  ctx.save();ctx.globalCompositeOperation='screen';
  radial(p.x,p.y,r*3.45,node.color,(.090+.07*hit)*alpha*birth);
  radial(p.x,p.y,r*1.65,node.color,(.145+.08*hit)*alpha*birth);

  // Overlapping cytoplasmic lobes give each light a small body.
  for(let k=0;k<7;k++){
    const a=k/7*TAU+phase*.07;
    const rr=r*(.48+.24*hash(node.seed+k*13));
    const x=p.x+Math.cos(a)*r*(.18+.23*hash(node.seed+k*7));
    const y=p.y+Math.sin(a)*r*(.14+.20*hash(node.seed+k*19));
    radial(x,y,rr,node.color,(.045+.035*hash(k+node.seed))*alpha*birth);
  }

  for(let ring=0;ring<3;ring++){
    const steps=48;ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const a=i/steps*TAU;
      const ripple=1+.09*Math.sin(3*a+phase+ring*.6)+.055*Math.sin(5*a-phase*.6+index);
      const rr=r*(.68+ring*.19)*ripple;
      const x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr*(.78+.035*Math.sin(phase+ring));
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();
    if(ring===0){ctx.fillStyle=rgba(node.color,.055*alpha*birth);ctx.fill();}
    ctx.strokeStyle=rgba(node.color,(.19-ring*.044)*alpha*birth);ctx.lineWidth=1.15+ring*.38;ctx.stroke();
  }

  const core=6.2+2.4*Math.sin(phase*.82)**2;
  radial(p.x,p.y,core*4.6,node.color,.32*alpha*birth);
  radial(p.x,p.y,core*1.25,C.ivory,.86*alpha*birth,.08);
  ctx.restore();

  // Birth ripples are local spatial events rather than a brightness switch.
  const age=clamp((t-node.wake)/2.4);
  if(age>0&&age<1){
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let k=0;k<3;k++){
      const q=clamp(age-k*.11);if(q<=0)continue;
      ctx.beginPath();ctx.ellipse(p.x,p.y,15+q*76,11+q*52,-.18+k*.06,0,TAU);
      ctx.strokeStyle=rgba(node.color,.19*Math.sin(Math.PI*q)*alpha);ctx.lineWidth=1.05;ctx.stroke();
    }
    ctx.restore();
  }
}

function extensionFor(node,index,arm){
  const ang=[-2.55,-1.1,.18,1.68][arm]+(hash(node.seed+arm*9)-.5)*.30;
  const len=72+hash(node.seed+arm*27)*61;
  const a=P(node.x,node.y);
  const d=P(Math.cos(ang),Math.sin(ang));
  const n=P(-d.y,d.x);
  const end=P(a.x+d.x*len,a.y+d.y*len);
  return makePath(a,P(a.x+d.x*len*.30+n.x*(hash(arm+3)-.5)*30,a.y+d.y*len*.30+n.y*(hash(arm+3)-.5)*30),P(a.x+d.x*len*.72-n.x*(hash(node.seed+arm)-.5)*24,a.y+d.y*len*.72-n.y*(hash(node.seed+arm)-.5)*24),end,62,node.seed+arm*17,3.6);
}
const ARMS=NODES.map((n,i)=>[0,1,2,3].map(a=>extensionFor(n,i,a)));

function link(a,b,seed,bend=0){
  const p=NODES[a],q=NODES[b],dx=q.x-p.x,dy=q.y-p.y,l=Math.max(1,Math.hypot(dx,dy)),nx=-dy/l,ny=dx/l;
  return makePath(P(p.x,p.y),P(p.x+dx*.31+nx*bend,p.y+dy*.31+ny*bend),P(p.x+dx*.70+nx*bend,p.y+dy*.70+ny*bend),P(q.x,q.y),108,seed,4.7);
}

const LINKS=[
  {a:0,b:1,start:T.words,end:16.45,path:link(0,1,201,-21),width:30},
  {a:0,b:3,start:15.35,end:17.20,path:link(0,3,223,24),width:33},
  {a:1,b:2,start:T.others,end:23.20,path:link(1,2,251,31),width:31},
  {a:2,b:4,start:21.55,end:24.25,path:link(2,4,277,-28),width:35},
  {a:3,b:4,start:22.35,end:25.00,path:link(3,4,303,29),width:36},
  {a:3,b:5,start:23.55,end:26.38,path:link(3,5,331,-26),width:33}
];
const CHOSEN_PATH=link(0,4,673,-38);

const DEAD=[
  {start:T.deadEnds,end:18.60,fade:21.1,path:makePath(P(245,635),P(158,675),P(88,620),P(45,565),84,401,6),color:C.gold,width:15},
  {start:T.deadEnds+.48,end:19.05,fade:21.8,path:makePath(P(332,790),P(250,870),P(205,934),P(151,959),82,419,5),color:C.rose,width:14},
  {start:T.deadEnds+.92,end:19.55,fade:22.3,path:makePath(P(395,422),P(448,342),P(515,312),P(550,250),82,443,5),color:C.violet,width:13}
];

const BORDER_REACH=makePath(P(508,645),P(557,628),P(611,657),P(653,620),132,503,5.5);
const LANGUAGE_PATHS=[
  makePath(P(360,650),P(426,542),P(566,468),P(674,498),150,541,8.5),
  makePath(P(370,660),P(485,625),P(552,546),P(678,535),148,547,7.2),
  makePath(P(356,668),P(438,720),P(574,630),P(676,575),148,557,7.8)
];

function preform(t){
  const a=smoother(T.first,T.first+.35,t)*(1-smoother(T.ignite-.35,T.ignite+.15,t));
  if(a<=0)return;
  ctx.save();ctx.globalCompositeOperation='screen';
  radial(245,635,128,C.blue,.052*a);
  for(let k=0;k<4;k++){
    ctx.beginPath();ctx.ellipse(245+Math.sin(t*.4+k)*8,635+Math.cos(t*.31+k)*11,25+k*12,16+k*9,-.18+k*.07,-1.0,1.35);
    ctx.strokeStyle=rgba(k%2?C.pearl:C.gold,(.052+.021*k)*a);ctx.lineWidth=1.2+k*.28;ctx.stroke();
  }
  ctx.restore();
}

function arms(t){
  const starts=[T.extend,T.words+.12,T.words+.46,T.words+.84,T.others+.55,T.others+1.35];
  NODES.forEach((node,ni)=>{
    const born=smoother(starts[ni],starts[ni]+2.55,t);if(born<=0)return;
    ARMS[ni].forEach((p,i)=>{
      const stagger=i*.18;
      const reveal=clamp(born-stagger);
      const post=smoother(T.changed,T.changed+3,t);
      ribbon(p,reveal,node.color,(13.5+i*1.55)*(1+.22*post),(.048+.018*post)*(ni<4?1:.88),t,{glow:i===1,current:false});
    });
  });
}

function connections(t){
  const changed=smoother(T.changed,T.changed+3.4,t);
  for(const e of LINKS){
    const reveal=smoother(e.start,e.end,t);if(reveal<=0)continue;
    const color=e.a%2?NODES[e.b].color:NODES[e.a].color;
    const ecology=smoother(T.livingField,T.livingField+3.0,t);
    let rerouted=e===LINKS[0]?1-.62*smoother(T.choice,T.nextWord+1.2,t):1;
    if(e===LINKS[2])rerouted*=1-.82*smoother(T.reaching,T.deeper,t);
    ribbon(e.path,reveal,color,e.width*(1+.18*changed),(.074+.024*changed)*(1-.16*ecology)*rerouted,t,{glow:true,current:false});
    if(reveal<.995)packet(e.path,reveal,color,.63,e.width*.58);
    else if(t>T.signals){
      const speed=.075+.012*(e.a%3);
      const u=(t*speed+e.a*.19+e.b*.11)%1;
      packet(e.path,u,color,.36+.22*smooth(T.signals,T.continuity,t),e.width*.52);
      if(t>T.rhythms)packet(e.path,1-((t*speed*.78+e.b*.23)%1),NODES[e.b].color,.28,e.width*.43);
    }
  }
  const chosen=smoother(T.choice,T.nextWord+2.35,t);
  if(chosen>0){
    ribbon(CHOSEN_PATH,chosen,C.pearl,31,.068+.018*smoother(T.changed,T.changed+2.5,t),t,{glow:true,current:false});
    if(chosen<.995)packet(CHOSEN_PATH,chosen,C.pearl,.72,16);
    else if(t>T.signals)packet(CHOSEN_PATH,(t*.086)%1,C.blue,.31,14);
  }
}

function deadEnds(t){
  for(const d of DEAD){
    const reveal=smoother(d.start,d.end,t);
    const vanish=1-smoother(d.end+.28,d.fade,t);
    if(reveal*vanish<=0)continue;
    const retreat=t>d.end?mix(1,.58,smoother(d.end+.25,d.fade,t)):reveal;
    ribbon(d.path,retreat,d.color,d.width*1.25,.072*vanish,t,{glow:true,current:false});
  }
}

function reach(t){
  const near=.91*smoother(T.reaching,T.reaching+5.08,t);
  const contact=.09*smoother(T.answer-.28,T.answer+.42,t);
  const r=clamp(near+contact);if(r<=0)return;
  ribbon(BORDER_REACH,r,C.green,25,.145+.045*smooth(T.answer,T.answer+2,t),t,{glow:true});
  if(r<.995)packet(BORDER_REACH,r,C.pearl,.82,17);
  if(t>T.answer){
    const age=t-T.answer;
    if(age<8.2)packet(BORDER_REACH,1-clamp(age/7.7),C.pearl,.88*(1-age/8.2),18);
    if(t>T.returns){
      const u=1-((t-T.returns)*.145%1);
      packet(BORDER_REACH,u,C.blue,.34,14);
    }
  }
}

function boundaryX(y,t){
  const contact=smoother(T.answer-.25,T.answer+.75,t);
  const final=smoother(T.distance+1.2,T.hands+.45,t);
  const local=Math.exp(-Math.pow((y-620)/190,2));
  return 666+3*Math.sin(y*.013+t*.18)-contact*18*local*Math.sin(Math.PI*clamp((t-(T.answer-.2))/3.8))-final*7*Math.exp(-Math.pow((y-505)/170,2));
}

function boundary(t){
  const awake=smoother(T.reaching-1.5,T.reaching+2.8,t);if(awake<=0)return;
  const response=smoother(T.answer-.25,T.answer+.7,t);
  const final=smoother(T.distance,T.hands+.5,t);
  ctx.save();ctx.globalCompositeOperation='screen';

  // The border is a refractive volume, not a permanent one-pixel wall.
  ctx.beginPath();
  for(let i=0;i<=120;i++){
    const y=60+i/120*(H-120),x=boundaryX(y,t);
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.lineTo(W,H-60);ctx.lineTo(W,60);ctx.closePath();
  const g=ctx.createLinearGradient(625,0,W,0);
  g.addColorStop(0,'rgba(135,190,207,0)');
  g.addColorStop(.35,rgba(C.pearl,.009*awake+.012*response));
  g.addColorStop(1,rgba(C.blue,.012*awake+.018*final));
  ctx.fillStyle=g;ctx.fill();

  ctx.beginPath();
  for(let i=0;i<=120;i++){
    const y=60+i/120*(H-120),x=boundaryX(y,t);
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  const sg=ctx.createLinearGradient(0,65,0,H-65);
  sg.addColorStop(0,rgba(C.pearl,0));
  sg.addColorStop(.25,rgba(C.pearl,.006*awake));
  sg.addColorStop(.40,rgba(C.pearl,(.018+.028*final)*awake));
  sg.addColorStop(.52,rgba(C.pearl,(.018+.075*response+.022*final)*awake));
  sg.addColorStop(.72,rgba(C.pearl,.007*awake));
  sg.addColorStop(1,rgba(C.pearl,0));
  ctx.strokeStyle=sg;ctx.lineWidth=3.0;ctx.shadowColor=rgba(C.blue,.16*response);ctx.shadowBlur=15*response;ctx.stroke();ctx.shadowBlur=0;
  radial(boundaryX(620,t),620,155,C.pearl,(.020*awake+.035*response));

  if(response>0){
    for(let k=0;k<5;k++){
      const age=clamp((t-(T.answer+k*.28))/4.8);if(age<=0||age>=1)continue;
      const x=boundaryX(620,t)-age*(108+k*11);
      ctx.beginPath();ctx.ellipse(x,620,10+age*(72+k*5),26+age*(160+k*12),-.05,Math.PI*.52,Math.PI*1.48);
      ctx.strokeStyle=rgba(k%2?C.blue:C.pearl,.115*Math.sin(Math.PI*age));ctx.lineWidth=2.4+k*.3;ctx.stroke();
    }
  }
  ctx.restore();
}

const MEMORY=[
  {x:215,y:545,seed:601,color:C.gold},
  {x:296,y:684,seed:607,color:C.rose},
  {x:438,y:553,seed:613,color:C.pearl},
  {x:455,y:760,seed:619,color:C.green},
  {x:258,y:857,seed:631,color:C.violet}
];

function memory(t){
  const a=smoother(T.memory,T.memory+.6,t)*(1-.45*smooth(T.form,T.livingField,t));if(a<=0)return;
  ctx.save();ctx.globalCompositeOperation='screen';
  MEMORY.forEach((m,i)=>{
    const q=smoother(T.memory+i*.24,T.memory+.75+i*.24,t);
    const pulse=.72+.28*Math.sin((t-T.memory)*1.2+i);
    radial(m.x,m.y,25+8*q,m.color,.11*a*q*pulse);
    radial(m.x,m.y,4.5,C.ivory,.45*a*q);
  });
  ctx.restore();
}

const MICRO=[
  {x:112,y:615,wake:60.98,color:C.gold,seed:701,to:P(166,425)},
  {x:257,y:306,wake:61.42,color:C.pearl,seed:709,to:P(395,422)},
  {x:545,y:370,wake:61.92,color:C.violet,seed:719,to:P(508,645)},
  {x:586,y:785,wake:62.46,color:C.green,seed:727,to:P(508,645)},
  {x:365,y:1015,wake:63.03,color:C.blue,seed:733,to:P(500,925)},
  {x:118,y:884,wake:63.54,color:C.rose,seed:743,to:P(332,790)},
  {x:302,y:556,wake:64.08,color:C.ivory,seed:751,to:P(245,635)},
  {x:452,y:835,wake:64.62,color:C.pearl,seed:761,to:P(500,925)}
];
MICRO.forEach(m=>{
  const dx=m.to.x-m.x,dy=m.to.y-m.y,nx=-dy/Math.max(1,Math.hypot(dx,dy)),ny=dx/Math.max(1,Math.hypot(dx,dy));
  m.path=makePath(P(m.x,m.y),P(m.x+dx*.30+nx*13,m.y+dy*.30+ny*13),P(m.x+dx*.72-nx*10,m.y+dy*.72-ny*10),m.to,66,m.seed,3.2);
});

function smallBody(m,t,i){
  const a=smoother(m.wake,m.wake+.78,t);if(a<=0)return;
  const phase=t*(.70+.07*(i%3))+m.seed;
  const r=(7.5+4*hash(m.seed))*a*(.86+.14*Math.sin(phase));
  ctx.save();ctx.globalCompositeOperation='screen';
  radial(m.x,m.y,r*3.5,m.color,.09*a);radial(m.x,m.y,r*1.4,m.color,.24*a);radial(m.x,m.y,2.8,C.ivory,.74*a);
  ctx.beginPath();
  for(let j=0;j<=30;j++){
    const ang=j/30*TAU,rr=r*(1+.16*Math.sin(3*ang+phase));
    const x=m.x+Math.cos(ang)*rr,y=m.y+Math.sin(ang)*rr*.76;
    if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();ctx.strokeStyle=rgba(m.color,.30*a);ctx.lineWidth=1;ctx.stroke();ctx.restore();
  const ext=smoother(T.extensions+i*.075,T.extensions+1.65+i*.075,t);
  ribbon(m.path,ext,m.color,8.5,.072,t,{glow:false,current:false});
  if(t>T.signals&&ext>.98){
    const u=(t*.14+i*.17)%1;packet(m.path,u,m.color,.32,8);
  }
}

function collectiveMembrane(t){
  const a=smoother(T.livingField,T.livingField+3.2,t);if(a<=0)return;
  const inhale=.91+.09*Math.sin(mix(t*.31,t*.52,smoother(T.continuity,T.continuity+3,t)));
  const pts=[P(91,596),P(127,370),P(282,272),P(500,315),P(597,505),P(620,786),P(525,1020),P(330,1080),P(135,938)];
  ctx.save();ctx.globalCompositeOperation='screen';ctx.beginPath();
  pts.forEach((p,i)=>{
    const x=366+(p.x-366)*inhale+6*Math.sin(t*.13+i),y=666+(p.y-666)*inhale+7*Math.cos(t*.11+i*.8);
    if(i===0)ctx.moveTo(x,y);else{
      const prev=pts[(i-1+pts.length)%pts.length];
      const px=366+(prev.x-366)*inhale,py=666+(prev.y-666)*inhale;
      ctx.quadraticCurveTo(px+(x-px)*.42,py+(y-py)*.42,x,y);
    }
  });
  ctx.closePath();ctx.fillStyle=rgba(C.blue,.025*a);ctx.fill();
  radial(365,666,390,C.blue,.017*a);radial(360,650,275,C.gold,.009*a);ctx.restore();
}

function finalReach(t){
  const reveal=smoother(T.language,T.distance+4.7,t);if(reveal<=0)return;
  const a=.072+.035*smoother(T.distance,T.hands,t);
  LANGUAGE_PATHS.forEach((p,i)=>{
    const r=clamp(reveal-i*.055);
    softFlow(p,r,i===1?C.pearl:C.blue,24+i*4,a*(i===1?1:.74),t);
  });
  if(reveal<.995)packet(LANGUAGE_PATHS[1],reveal,C.blue,.92,20);
  else packet(LANGUAGE_PATHS[1],((t-T.distance)*.11)%1,C.ivory,.36,16);

  const outside=smoother(T.distance+2.0,T.hands+.25,t);
  if(outside>0){
    ctx.save();ctx.globalCompositeOperation='screen';
    radial(732,495,150,C.blue,.095*outside);radial(706,510,74,C.pearl,.135*outside);
    ctx.restore();
  }

  const hands=smoother(T.hands,T.voiceEnd-.22,t);if(hands<=0)return;
  const x=661,y=535,open=hands;
  ctx.save();ctx.globalCompositeOperation='screen';
  // Soft terminal pads gather at the veil. Their gesture can be read as touch,
  // without resolving into a literal hand illustration.
  [[-30,-72,42,62,C.pearl],[-39,-27,50,68,C.blue],[-35,28,46,64,C.green],[28,-42,48,70,C.pearl],[35,24,50,67,C.blue]].forEach((d,i)=>{
    const cx=x+d[0]*open,cy=y+d[1]*open,rx=d[2]*open,ry=d[3]*open,color=d[4];
    if(rx<=0)return;
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rx,ry));
    g.addColorStop(0,rgba(color,.14*open));g.addColorStop(.62,rgba(color,.056*open));g.addColorStop(1,rgba(color,0));
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,(i-2)*.12,0,TAU);ctx.fill();
  });
  [-78,-38,0,39,77].forEach((dy,i)=>radial(x+(i%2?2:-2),y+dy*open,24+(i%3)*3,i%2?C.blue:C.pearl,.21*open));
  radial(x,y,96,C.pearl,.10*open);radial(x,y,10,C.ivory,.68*open);
  ctx.restore();
}

const grainLayers=[];
for(let layer=0;layer<4;layer++){
  const c=createCanvas(W,H),g=c.getContext('2d');g.clearRect(0,0,W,H);
  for(let i=0;i<530;i++){
    const x=hash(i*13+layer*101)*W,y=hash(i*29+layer*211)*H;
    const a=.018+.035*hash(i*7+layer*17),s=.45+1.05*hash(i+layer*31);
    g.fillStyle=`rgba(222,232,226,${a})`;g.fillRect(x,y,s,s);
  }
  grainLayers.push(c);
}

function field(t){
  const driftX=18*Math.sin(t*.025),driftY=24*Math.cos(t*.019);
  const bg=ctx.createRadialGradient(344+driftX,650+driftY,42,350,650,890);
  bg.addColorStop(0,'#192227');bg.addColorStop(.46,'#0e171b');bg.addColorStop(1,'#05090d');
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

  for(let i=0;i<8;i++){
    const x=80+hash(i+901)*560+10*Math.sin(t*(.025+.003*i)+i);
    const y=110+hash(i+933)*1040+13*Math.cos(t*(.021+.002*i)+i*.7);
    const r=160+hash(i+977)*210;
    const color=i%3===0?C.blue:(i%3===1?C.gold:C.green);
    radial(x,y,r,color,.016+.010*Math.sin(t*.09+i)**2);
  }

  // Slow refractions keep the whole medium moving even before the first body forms.
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let k=0;k<4;k++){
    const y=250+k*245+28*Math.sin(t*.05+k);
    ctx.beginPath();ctx.moveTo(-70,y);
    ctx.bezierCurveTo(135,y-90+30*Math.sin(t*.035+k),430,y+100*Math.cos(t*.027+k),790,y-30);
    ctx.strokeStyle=rgba(k%2?C.blue:C.gold,.0105);ctx.lineWidth=58+k*13;ctx.stroke();
  }
  ctx.globalAlpha=.42;ctx.drawImage(grainLayers[Math.floor(t*7)%grainLayers.length],0,0);ctx.restore();
}

function globalReturnWaves(t){
  const a=smoother(T.answer,T.answer+.5,t)*(1-smoother(T.form,T.livingField,t));if(a<=0)return;
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let i=0;i<7;i++){
    const age=clamp((t-(T.answer+i*.44))/9.2);if(age<=0||age>=1)continue;
    const x=666-age*770;
    const g=ctx.createLinearGradient(x-85,0,x+85,0);
    g.addColorStop(0,'rgba(120,185,211,0)');g.addColorStop(.5,rgba(C.blue,.034*Math.sin(Math.PI*age)));g.addColorStop(1,'rgba(120,185,211,0)');
    ctx.fillStyle=g;ctx.fillRect(x-85,0,170,H);
  }
  ctx.restore();
}

function frame(t){
  ctx.resetTransform();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;field(t);
  preform(t);

  const camera=smoother(T.form,T.livingField+2.5,t);
  const scale=mix(1.027,.982,camera)+.0055*Math.sin(t*.085);
  const panX=mix(7,-5,camera)+3.8*Math.sin(t*.055),panY=mix(9,-4,camera)+3.5*Math.cos(t*.049);
  ctx.save();ctx.translate(W/2+panX,H/2+panY);ctx.scale(scale,scale);ctx.translate(-W/2,-H/2);
  collectiveMembrane(t);deadEnds(t);arms(t);connections(t);reach(t);memory(t);
  MICRO.forEach((m,i)=>smallBody(m,t,i));
  NODES.forEach((n,i)=>body(n,i,t,1,1));
  boundary(t);finalReach(t);ctx.restore();
  globalReturnWaves(t);

  const fadeIn=1-smoother(0,1.1,t);
  const fadeOut=smoother(88.55,DURATION,t);
  const fade=clamp(fadeIn+fadeOut);
  if(fade>0){ctx.fillStyle=`rgba(3,6,9,${fade})`;ctx.fillRect(0,0,W,H);}
  return canvas;
}

function score(file){
  const n=Math.ceil(SR*DURATION),L=new Float32Array(n),R=new Float32Array(n);
  const add=(start,dur,freq,amp,pan=0,kind='pad')=>{
    const a=Math.max(0,Math.floor(start*SR)),b=Math.min(n,Math.floor((start+dur)*SR));
    for(let i=a;i<b;i++){
      const q=i/SR-start;
      const env=kind==='spark'
        ?smooth(0,.018,q)*Math.exp(-q*1.18)*(1-smooth(dur-.8,dur,q))
        :smooth(0,1.4,q)*Math.exp(-q/(dur*1.5))*(1-smooth(dur-1.8,dur,q));
      const flutter=1+.025*Math.sin(TAU*.073*q+freq*.01);
      const s=Math.sin(TAU*freq*flutter*q)+.16*Math.sin(TAU*freq*2.001*q)+.055*Math.sin(TAU*freq*.5*q);
      L[i]+=s*env*amp*Math.sqrt((1-pan)/2);R[i]+=s*env*amp*Math.sqrt((1+pan)/2);
    }
  };

  add(0,DURATION,55,.010,-.16);add(0,DURATION,73.416,.009,.13);add(7,DURATION-8,110,.006,0);
  [
    [T.ignite,220,C.gold,-.28],[T.attention,261.626,C.pearl,-.55],[T.question,329.628,C.violet,.10],
    [T.presence,391.995,C.rose,-.02],[T.others,493.883,C.green,.48],[T.others+2.1,587.33,C.blue,.44]
  ].forEach(([time,f,,pan])=>{add(time,5.8,f,.035,pan,'spark');add(time+.34,4.8,f*1.5,.010,-pan*.5,'spark');});
  [130.813,196,261.626,329.628,523.251].forEach((f,i)=>add(T.answer+i*.075,10-i*.45,f,.019+i*.001,i*.18-.36,'spark'));
  [391.995,329.628,261.626,220].forEach((f,i)=>add(T.returns+i*.48,5.4,f,.018,.43-i*.28,'spark'));
  [T.lights,T.extensions,T.signals,T.continuity,T.changed,T.language,T.hands].forEach((time,i)=>add(time,6.5,[293.665,349.228,440,523.251,392,587.33,659.255][i],.017,(i%3-.9)*.26,'spark'));

  let low=0;
  for(let i=0;i<n;i++){
    const rnd=hash(i*17+1301)*2-1;low=.9987*low+.0013*rnd;
    const breath=low*.0025*(.67+.33*Math.sin(TAU*i/SR*.049));L[i]+=breath;R[i]+=breath*.92;
  }
  for(const [delay,gain] of [[.173,.13],[.307,.075],[.521,.04]]){
    const d=Math.floor(delay*SR);
    for(let i=d;i<n;i++){const l=L[i-d],r=R[i-d];L[i]+=r*gain;R[i]+=l*gain;}
  }
  let peak=0;
  for(let i=0;i<n;i++){
    const time=i/SR,e=smoother(0,1.5,time)*(1-smoother(88.1,DURATION,time));
    L[i]*=e;R[i]*=e;peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));
  }
  const scale=.46/Math.max(.001,peak),buf=Buffer.alloc(44+n*4);
  buf.write('RIFF',0);buf.writeUInt32LE(36+n*4,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);
  buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*4,28);
  buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*4,40);
  for(let i=0;i<n;i++){
    buf.writeInt16LE(Math.round(clamp(L[i]*scale,-1,1)*32767),44+i*4);
    buf.writeInt16LE(Math.round(clamp(R[i]*scale,-1,1)*32767),46+i*4);
  }
  fs.writeFileSync(file,buf);
}

async function preview(){
  fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(REVIEW,{recursive:true});
  const times=[1.9,4.9,9.8,13.5,18.5,23.4,31.7,37.9,41.5,45.0,50.8,57.8,62.1,65.2,70.8,74.8,78.4,82.5,87.3,88.0];
  for(let i=0;i<times.length;i++){
    const file=path.join(REVIEW,`frame-${String(i+1).padStart(2,'0')}-${times[i].toFixed(1)}s.jpg`);
    fs.writeFileSync(file,frame(times[i]).toBuffer('image/jpeg',93));
  }
  frame(87.3);fs.writeFileSync(path.join(OUT,'quando-o-campo-responde-narrado-poster.jpg'),canvas.toBuffer('image/jpeg',95));
}

async function render(){
  if(!fs.existsSync(VOICE))throw Error(`Narração ausente: ${VOICE}`);
  fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(REVIEW,{recursive:true});
  const bed=path.join(REVIEW,'score.wav');score(bed);
  const suffix=DRAFT?'-draft':'';
  const target=path.join(OUT,`quando-o-campo-responde-narrado${suffix}.mp4`);
  const temp=path.join(REVIEW,`render-${process.pid}${suffix}.mp4`);
  const filter=`[1:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(VOICE_DELAY*1000)}|${Math.round(VOICE_DELAY*1000)}[voice];[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.18[bed];[voice][bed]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]`;
  const ff=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','mjpeg','-framerate',String(FPS),'-i','pipe:0','-i',VOICE,'-i',bed,'-filter_complex',filter,'-map','0:v:0','-map','[aout]','-c:v','libx264','-preset',DRAFT?'veryfast':'medium','-crf',DRAFT?'24':'19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',String(DURATION),'-metadata','title=Quando o campo responde — versão narrada','-metadata','artist=Caelion','-metadata','comment=Direção sensível e interlocução: Isa',temp],{stdio:['pipe','ignore','pipe']});
  let err='';ff.stderr.on('data',d=>err+=d);ff.stdin.on('error',()=>{});const done=once(ff,'close');
  for(let i=0;i<FRAMES;i++){
    const data=frame(i/FPS).toBuffer('image/jpeg',DRAFT?87:92);
    if(!ff.stdin.write(data))await once(ff.stdin,'drain');
    if(i%(FPS*5)===0)console.log(`quadro ${i}/${FRAMES} · ${(i/FPS).toFixed(1)}s`);
  }
  ff.stdin.end();const [code]=await done;if(code)throw Error(err||`ffmpeg ${code}`);
  fs.renameSync(temp,target);
  frame(87.3);fs.writeFileSync(path.join(OUT,'quando-o-campo-responde-narrado-poster.jpg'),canvas.toBuffer('image/jpeg',95));
  fs.writeFileSync(path.join(REVIEW,`render-report${suffix}.json`),JSON.stringify({width:W,height:H,fps:FPS,frames:FRAMES,duration:DURATION,voiceDelay:VOICE_DELAY,voice:path.relative(ROOT,VOICE),bytes:fs.statSync(target).size,draft:DRAFT},null,2)+'\n');
}

const mode=process.argv[2]||'--preview';
Promise.resolve().then(()=>mode==='--render'?render():preview()).catch(e=>{console.error(e);process.exitCode=1;});

