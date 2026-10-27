const $=s=>document.querySelector(s);
const FILES='abcdefgh', GL={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}, gl=t=>GL[t]+'\uFE0E';
const sqName=i=>FILES[i&7]+(8-(i>>3));
const DIRS={n:[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]],k:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],b:[[1,1],[1,-1],[-1,1],[-1,-1]],r:[[1,0],[-1,0],[0,1],[0,-1]]};
const VAL={p:1,n:3,b:3,r:5,q:9};

/* ---------- motor ---------- */
function initState(){
  const b=[];
  for(const ch of 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'){
    if(ch==='/')continue;
    if(/\d/.test(ch)){for(let k=0;k<+ch;k++)b.push(null);continue;}
    b.push((ch===ch.toUpperCase()?'w':'b')+ch.toLowerCase());
  }
  return{board:b,turn:'w',cr:{wK:1,wQ:1,bK:1,bQ:1},ep:null,half:0,full:1};
}
const inb=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
function attacked(b,sq,by){
  const r=sq>>3,c=sq&7,pr=by==='w'?r+1:r-1;
  if(pr>=0&&pr<8)for(const dc of[-1,1]){const cc=c+dc;if(cc>=0&&cc<8&&b[pr*8+cc]===by+'p')return true;}
  for(const[dr,dc]of DIRS.n){const rr=r+dr,cc=c+dc;if(inb(rr,cc)&&b[rr*8+cc]===by+'n')return true;}
  for(const[dr,dc]of DIRS.k){const rr=r+dr,cc=c+dc;if(inb(rr,cc)&&b[rr*8+cc]===by+'k')return true;}
  for(const[set,t]of[[DIRS.b,'b'],[DIRS.r,'r']])for(const[dr,dc]of set){
    let rr=r+dr,cc=c+dc;
    while(inb(rr,cc)){const p=b[rr*8+cc];if(p){if(p[0]===by&&(p[1]===t||p[1]==='q'))return true;break;}rr+=dr;cc+=dc;}
  }
  return false;
}
function gen(s,color){
  const b=s.board,out=[],opp=color==='w'?'b':'w';
  for(let i=0;i<64;i++){
    const p=b[i];if(!p||p[0]!==color)continue;
    const r=i>>3,c=i&7,t=p[1];
    if(t==='p'){
      const d=color==='w'?-1:1,start=color==='w'?6:1,last=color==='w'?0:7,r1=r+d;
      const push=(to,cap)=>{if((to>>3)===last)for(const pr of'qrbn')out.push({from:i,to,piece:p,cap,promo:pr});else out.push({from:i,to,piece:p,cap});};
      if(r1<0||r1>7)continue;
      if(!b[r1*8+c]){push(r1*8+c);if(r===start&&!b[(r+2*d)*8+c])out.push({from:i,to:(r+2*d)*8+c,piece:p,dbl:true});}
      for(const dc of[-1,1]){
        const cc=c+dc;if(cc<0||cc>7)continue;
        const to=r1*8+cc,q=b[to];
        if(q&&q[0]!==color)push(to,q[1]);
        else if(!q&&to===s.ep)out.push({from:i,to,piece:p,cap:'p',ep:true});
      }
      continue;
    }
    const dirs=t==='q'?[...DIRS.b,...DIRS.r]:DIRS[t],slide=t==='b'||t==='r'||t==='q';
    for(const[dr,dc]of dirs){
      let rr=r+dr,cc=c+dc;
      while(inb(rr,cc)){
        const to=rr*8+cc,q=b[to];
        if(!q)out.push({from:i,to,piece:p});
        else{if(q[0]!==color)out.push({from:i,to,piece:p,cap:q[1]});break;}
        if(!slide)break;rr+=dr;cc+=dc;
      }
    }
    if(t==='k'&&i===(color==='w'?60:4)&&!attacked(b,i,opp)){
      if(s.cr[color+'K']&&!b[i+1]&&!b[i+2]&&b[i+3]===color+'r'&&!attacked(b,i+1,opp)&&!attacked(b,i+2,opp))out.push({from:i,to:i+2,piece:p,castle:'K'});
      if(s.cr[color+'Q']&&!b[i-1]&&!b[i-2]&&!b[i-3]&&b[i-4]===color+'r'&&!attacked(b,i-1,opp)&&!attacked(b,i-2,opp))out.push({from:i,to:i-2,piece:p,castle:'Q'});
    }
  }
  return out;
}
function apply(s,m){
  const b=s.board.slice(),color=m.piece[0],opp=color==='w'?'b':'w';
  b[m.from]=null;
  if(m.ep)b[m.to+(color==='w'?8:-8)]=null;
  b[m.to]=m.promo?color+m.promo:m.piece;
  if(m.castle==='K'){b[m.to-1]=b[m.to+1];b[m.to+1]=null;}
  if(m.castle==='Q'){b[m.to+1]=b[m.to-2];b[m.to-2]=null;}
  const cr={...s.cr};
  if(m.piece[1]==='k'){cr[color+'K']=0;cr[color+'Q']=0;}
  for(const q of[m.from,m.to]){if(q===0)cr.bQ=0;if(q===7)cr.bK=0;if(q===56)cr.wQ=0;if(q===63)cr.wK=0;}
  return{board:b,turn:opp,cr,ep:m.dbl?(m.from+m.to)/2:null,half:(m.piece[1]==='p'||m.cap)?0:s.half+1,full:s.full+(color==='b'?1:0)};
}
const inCheck=s=>attacked(s.board,s.board.indexOf(s.turn+'k'),s.turn==='w'?'b':'w');
function legal(s){
  const col=s.turn,opp=col==='w'?'b':'w';
  return gen(s,col).filter(m=>{const n=apply(s,m);return!attacked(n.board,n.board.indexOf(col+'k'),opp);});
}
function san(s,m,ls,n){
  let str;
  if(m.castle)str=m.castle==='K'?'O-O':'O-O-O';
  else{
    const t=m.piece[1];
    if(t==='p'){str=(m.cap?FILES[m.from&7]+'x':'')+sqName(m.to)+(m.promo?'='+m.promo.toUpperCase():'');}
    else{
      str=t.toUpperCase();
      const amb=ls.filter(o=>o!==m&&o.piece===m.piece&&o.to===m.to);
      if(amb.length){
        const sf=amb.some(o=>(o.from&7)===(m.from&7)),sr=amb.some(o=>(o.from>>3)===(m.from>>3));
        str+=!sf?FILES[m.from&7]:!sr?8-(m.from>>3):sqName(m.from);
      }
      str+=(m.cap?'x':'')+sqName(m.to);
    }
  }
  const has=legal(n).length>0,chk=inCheck(n);
  return str+(chk?(has?'+':'#'):'');
}
const uci=m=>sqName(m.from)+sqName(m.to)+(m.promo||'');
const key=s=>s.board.map(x=>x||'-').join('')+s.turn+JSON.stringify(s.cr)+s.ep;

/* ---------- estado de partida ---------- */
let G,room=null,slots=[null,null],meId=null,sel=null,selMoves=[],viewFlip=false,drag=null,confirmResign=false,code='';
function reset(g){G={g,moves:[],sans:[],states:[initState()],last:null,resigned:null};sel=null;selMoves=[];confirmResign=false;}
reset(0);
const cur=()=>G.states[G.states.length-1];
const colorOfSlot=i=>((i^(G.g%2))===0)?'w':'b';
const slotOfColor=c=>(c==='w'?0:1)^(G.g%2);
const myIdx=()=>slots.indexOf(meId);
const myColor=()=>{const i=myIdx();return i<0?null:colorOfSlot(i);};
const oppHere=()=>!!(slots[0]&&slots[1]);
function status(){
  const s=cur(),ls=legal(s),chk=inCheck(s);
  const side=c=>c==='w'?'blancas':'negras';
  if(G.resigned)return{over:1,ls:[],chk,text:`Se rinden las ${side(G.resigned)} · Ganan ${side(G.resigned==='w'?'b':'w')}`};
  if(!ls.length)return chk?{over:1,ls,chk,text:`Jaque mate · Ganan ${side(s.turn==='w'?'b':'w')}`}:{over:1,ls,chk,text:'Tablas por rey ahogado'};
  if(s.half>=100)return{over:1,ls,chk,text:'Tablas · regla de los 50 movimientos'};
  const k=key(s);
  if(G.states.filter(x=>key(x)===k).length>=3)return{over:1,ls,chk,text:'Tablas por triple repetición'};
  const rest=s.board.filter(p=>p&&p[1]!=='k');
  if(rest.length===0||(rest.length===1&&'bn'.includes(rest[0][1])))return{over:1,ls,chk,text:'Tablas por material insuficiente'};
  return{over:0,ls,chk};
}
let ac;
function sound(cap){try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.value=cap?200:320;g.gain.setValueAtTime(.15,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.12);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+.12);}catch(e){}}
function doMove(m,silent){
  const s=cur(),ls=legal(s),n=apply(s,m);
  G.sans.push(san(s,m,ls,n));G.moves.push(uci(m));G.states.push(n);G.last=m;
  sel=null;selMoves=[];if(!silent)sound(!!m.cap);
}
function tryMove(m){
  const n=G.moves.length;doMove(m);render();
  if(room)room.emit('move',{g:G.g,n,m:uci(m)}).catch(()=>{});
}

/* ---------- red ---------- */
function sendSync(){
  if(!room||myIdx()<0)return;
  room.emit('sync',{g:G.g,moves:G.moves,resigned:G.resigned}).catch(()=>{});
}
function adopt(d){
  if(!d||!Array.isArray(d.moves)||typeof d.g!=='number')return;
  const better=d.g>G.g||(d.g===G.g&&(d.moves.length>G.moves.length||(d.resigned&&!G.resigned)));
  if(!better)return;
  reset(d.g);
  for(const u of d.moves){const m=legal(cur()).find(x=>uci(x)===u);if(!m)break;doMove(m,true);}
  G.resigned=d.resigned==='w'||d.resigned==='b'?d.resigned:null;
  render();
}
function onPeers(ch){
  const vs=room.peers().filter(p=>p.kind==='viewer'),ids=vs.map(p=>p.peer);
  const me=vs.find(p=>p.sameTab);meId=me?me.peer:null;
  if(!slots[0]&&!slots[1]){if(ids.length>=2){const s=[...ids].sort();slots=[s[0],s[1]];}}
  else{
    slots=slots.map(x=>ids.includes(x)?x:null);
    const free=ids.filter(x=>!slots.includes(x)).sort();
    slots=slots.map(x=>x||free.shift()||null);
  }
  if(ch.joined.some(p=>!p.isMe&&p.kind==='viewer'))sendSync();
  render();
}
function connectRoom(c){
  return new Promise((resolve,reject)=>{
    let ws, me=null, ids=[], H={}, PH=[], resolved=false;
    
    function initWS(){
      ws = new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
      
      ws.onopen = () => ws.send(JSON.stringify({t:'join',code:c}));
      ws.onerror = err => { if(!resolved) reject(new Error('ws')); };
      ws.onclose = () => {
        ids = ids.filter(x=>x===me);
        PH.forEach(f=>f({joined:[]}));
        setTimeout(() => { if(room) initWS(); }, 2000);
      };
      
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if(m.t==='hello'){
          me = m.id;
          if(!resolved){ resolved=true; resolve(api); }
          else { sendSync(); }
        } else if(m.t==='peers'){
          const old = ids; ids = m.ids;
          const joined = api.peers().filter(p=>!old.includes(p.peer));
          PH.forEach(f=>f({joined}));
        } else if(m.t==='msg'){
          (H[m.topic]||[]).forEach(f=>f({sameTab:false,isMe:false,peer:m.from,data:m.data}));
        }
      };
    }
    
    const api = {
      emit:(t,d)=>{ if(ws && ws.readyState===1) ws.send(JSON.stringify({t:'emit',topic:t,data:d})); return Promise.resolve(); },
      on:(t,f)=>{ (H[t]=H[t]||[]).push(f); },
      peers:()=>ids.map(id=>({peer:id,kind:'viewer',sameTab:id===me,isMe:id===me})),
      onPeers:f=>{ PH.push(f); if(ids.length)f({joined:api.peers()}); },
      onConnection:()=>{},
      leave:()=>{ if(ws) ws.close(); return Promise.resolve(); }
    };
    
    initWS();
  });
}
async function join(c){
  room=await connectRoom(c);
  room.on('move',m=>{
    if(m.sameTab)return;const d=m.data||{};
    if(d.g!==G.g||d.n>G.moves.length){room.emit('ask',{});return;}
    if(d.n<G.moves.length||status().over)return;
    const s=cur();if(slots[slotOfColor(s.turn)]!==m.peer)return;
    const mv=legal(s).find(x=>uci(x)===d.m);if(mv){doMove(mv);render();}
  });
  room.on('sync',m=>{if(!m.sameTab&&slots.includes(m.peer))adopt(m.data);});
  room.on('ask',m=>{if(!m.sameTab)sendSync();});
  room.on('resign',m=>{
    const d=m.data||{};if(m.sameTab||d.g!==G.g||status().over)return;
    if((d.c==='w'||d.c==='b')&&slots[slotOfColor(d.c)]===m.peer){G.resigned=d.c;render();}
  });
  room.on('rematch',m=>{
    const d=m.data||{};if(m.sameTab)return;
    if(d.g===G.g+1&&slots.includes(m.peer)){reset(d.g);render();}
  });
  room.onPeers(onPeers);
}

/* ---------- interfaz ---------- */
function captured(s){
  const base={p:8,n:2,b:2,r:2,q:1},cnt={w:{p:0,n:0,b:0,r:0,q:0},b:{p:0,n:0,b:0,r:0,q:0}};
  for(const p of s.board)if(p&&p[1]!=='k')cnt[p[0]][p[1]]++;
  const miss={w:{},b:{}};
  for(const c of'wb')for(const t in base)miss[c][t]=Math.max(0,base[t]-cnt[c][t]);
  return miss;
}
function bar(color,miss){
  const opp=color==='w'?'b':'w';
  let str='',mat=0;
  for(const t of'qrbnp'){for(let k=0;k<miss[opp][t];k++)str+=gl(t);mat+=VAL[t]*(miss[opp][t]-miss[color][t]);}
  const mine=myColor();
  const nm=mine===null?(color==='w'?'Blancas':'Negras'):(color===mine?'Tú':'Rival');
  const slot=slots[slotOfColor(color)];
  const dot=slot||mine===color?'':' · esperando…';
  return`<div class="av">${color==='w'?'♔':'♚'}</div><div class="nm">${nm}${dot}<small class="sm">${str}${mat>0?`<span style="color:#bbb;font-size:12px">+${mat}</span>`:''}</small></div>`;
}
function render(){
  const s=cur(),st=status(),mine=myColor(),miss=captured(s);
  const bottom=((mine==='b')!==viewFlip)?'b':'w',top=bottom==='w'?'b':'w';
  const kingSq=st.chk?s.board.indexOf(s.turn+'k'):-1;
  const last=G.last,canMove=!st.over&&mine===s.turn&&oppHere();
  let h='';
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const i=bottom==='w'?r*8+c:(7-r)*8+(7-c),p=s.board[i],light=((i>>3)+(i&7))%2===0;
    const tm=sel!==null?selMoves.find(m=>m.to===i):null;
    let cls='sq '+(light?'l':'d');
    if((last&&(last.from===i||last.to===i))||sel===i)cls+=' hl';
    if(i===kingSq)cls+=' chk';
    if(tm)cls+=tm.cap?' cap':' dot';
    h+=`<div class="${cls}" data-i="${i}">${c===0?`<b class="rk">${8-(i>>3)}</b>`:''}${r===7?`<b class="fl">${FILES[i&7]}</b>`:''}${p?`<span class="pc ${p[0]}${drag&&drag.i===i?' dim':''}">${gl(p[1])}</span>`:''}</div>`;
  }
  $('#board').innerHTML=h;
  $('#topBar').innerHTML=bar(top,miss);
  $('#botBar').innerHTML=bar(bottom,miss);
  let t;
  if(st.over)t=st.text;
  else if(!oppHere())t=`Esperando rival… Dile que meta el código ${code}`;
  else if(mine===null)t=`Espectador · Turno de ${s.turn==='w'?'blancas':'negras'}`;
  else t=(mine===s.turn?'Tu turno':'Turno del rival')+(st.chk?' · Jaque':'');
  const se=$('#status');se.textContent=t;se.className=st.over?'over':'';
  let mh='';
  for(let k=0;k<G.sans.length;k+=2){
    const n=k+1===G.sans.length-0?'':'';
    mh+=`<div class="mv"><i>${k/2+1}.</i><span class="${k===G.sans.length-1?'cur':''}">${G.sans[k]}</span><span class="${k+1===G.sans.length-1?'cur':''}">${G.sans[k+1]||''}</span></div>`;
  }
  const mv=$('#moves');mv.innerHTML=mh;mv.scrollTop=mv.scrollHeight;
  $('#resign').hidden=st.over||mine===null||!oppHere();
  $('#resign').textContent=confirmResign?'¿Seguro?':'Rendirse';
  $('#rematch').hidden=!(st.over&&mine!==null);
}
function askPromo(ms,color){
  const p=$('#promo');
  p.innerHTML=['q','n','r','b'].map(t=>`<button data-t="${t}"><span class="pc ${color}">${gl(t)}</span></button>`).join('');
  p.hidden=false;
  p.onclick=e=>{
    p.hidden=true;const b=e.target.closest('button');
    if(!b){sel=null;selMoves=[];render();return;}
    const m=ms.find(x=>x.promo===b.dataset.t);if(m)tryMove(m);
  };
}
function choose(ms){
  if(ms.length>1)askPromo(ms,ms[0].piece[0]);else tryMove(ms[0]);
}
const canMove=()=>{const st=status();return!st.over&&myColor()===cur().turn&&oppHere();};
$('#board').addEventListener('pointerdown',e=>{
  const el=e.target.closest('.sq');if(!el||!canMove()||!$('#promo').hidden)return;
  const i=+el.dataset.i,s=cur(),ls=status().ls;
  if(sel!==null){const ms=selMoves.filter(m=>m.to===i);if(ms.length){choose(ms);return;}}
  const p=s.board[i];
  if(p&&p[0]===myColor()){
    sel=i;selMoves=ls.filter(m=>m.from===i);
    const size=$('#board').clientWidth*.106;
    const g=document.createElement('div');
    g.className='pc ghost '+p[0];g.textContent=gl(p[1]);g.style.fontSize=size+'px';
    g.style.left=e.clientX+'px';g.style.top=e.clientY+'px';
    document.body.append(g);
    drag={i,g,moved:false};render();
    const mv=ev=>{drag.g.style.left=ev.clientX+'px';drag.g.style.top=ev.clientY+'px';};
    const up=ev=>{
      window.removeEventListener('pointermove',mv);
      const d=drag;drag=null;d.g.remove();
      const t=document.elementFromPoint(ev.clientX,ev.clientY),tq=t&&t.closest('.sq');
      if(tq&&+tq.dataset.i!==d.i){
        const ms=selMoves.filter(m=>m.to===+tq.dataset.i);
        if(ms.length){choose(ms);return;}
        sel=null;selMoves=[];
      }
      render();
    };
    window.addEventListener('pointermove',mv);
    window.addEventListener('pointerup',up,{once:true});
  }else{sel=null;selMoves=[];render();}
});
$('#flip').onclick=()=>{viewFlip=!viewFlip;render();};
$('#resign').onclick=()=>{
  if(!confirmResign){confirmResign=true;render();setTimeout(()=>{if(confirmResign){confirmResign=false;render();}},3000);return;}
  const c=myColor();if(!c)return;
  G.resigned=c;confirmResign=false;render();
  if(room)room.emit('resign',{g:G.g,c}).catch(()=>{});
};
$('#rematch').onclick=()=>{
  reset(G.g+1);render();
  if(room)room.emit('rematch',{g:G.g}).catch(()=>{});
};
$('#leave').onclick=async()=>{
  try{if(room)await room.leave();}catch(e){}
  room=null;slots=[null,null];meId=null;reset(0);
  $('#game').hidden=true;$('#lobby').hidden=false;$('#err').textContent='';
};

/* ---------- lobby ---------- */
const inp=$('#code'),btn=$('#play');
inp.addEventListener('input',()=>{inp.value=inp.value.replace(/\D/g,'').slice(0,4);btn.disabled=inp.value.length!==4;});
inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!btn.disabled)btn.click();});
btn.onclick=async()=>{
  code=inp.value;btn.disabled=true;$('#err').textContent='Conectando…';
  try{
    await join(code);
    $('#err').textContent='';
    $('#roomCode').textContent=code;
    $('#lobby').hidden=true;$('#game').hidden=false;
    viewFlip=false;render();
  }catch(e){
    room=null;
    $('#err').textContent='No se pudo conectar al servidor. Ejecuta: node server.js';
  }
  btn.disabled=inp.value.length!==4;
};
