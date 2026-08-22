import Phaser from 'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.esm.js';

const log = document.getElementById('log');
const moneyEl = document.getElementById('money');
const jobEl = document.getElementById('job');
const addLog = (s) => { const d=document.createElement('div'); d.textContent=s; log.appendChild(d); log.scrollTop=log.scrollHeight; };

const socket = new WebSocket(`ws://${location.hostname}:3001`);
const remotes = new Map(); let selfId=null; let selfStats={money:250,job:'باحث عن عمل'};
const sceneState={};

class Cairo extends Phaser.Scene {
  constructor(){super('Cairo')}
  create(){
    this.cameras.main.setBackgroundColor('#101820');
    // ground
    const g=this.add.graphics();
    g.fillStyle(0x1b2935); g.fillRect(0,0,1200,700);
    // roads
    g.fillStyle(0x303a43); g.fillRect(0,250,1200,120); g.fillRect(510,0,150,700);
    g.lineStyle(2,0x58636d,0.6); for(let x=0;x<1200;x+=60){g.lineBetween(x,305,x+30,305)} for(let y=0;y<700;y+=60){g.lineBetween(585,y,585,y+30)}
    // blocks/buildings
    const buildings=[
      [60,60,300,140,'سوق القاهرة'],[760,60,330,140,'عمارة النيل'],[60,430,300,180,'منطقة سكنية'],[760,430,330,180,'مركز الخدمات']
    ];
    for(const [x,y,w,h,label] of buildings){g.fillStyle(0x223646);g.fillRoundedRect(x,y,w,h,12);g.lineStyle(2,0x3e6177);g.strokeRoundedRect(x,y,w,h,12);this.add.text(x+w/2,y+h/2,label,{fontSize:'18px',color:'#c9d8e5'}).setOrigin(.5)}
    // shop
    g.fillStyle(0x2c78a0);g.fillRoundedRect(400,90,250,100,12);g.lineStyle(3,0x66b4df);g.strokeRoundedRect(400,90,250,100,12);this.add.text(525,140,'🏪 محل للبيع / للإيجار',{fontSize:'18px'}).setOrigin(.5);
    // NPCs
    this.npcs=[]; for(let i=0;i<18;i++){const x=70+(i*61)%1030,y=220+(i*83)%380; const c=this.add.circle(x,y,9,0xd9a441); this.npcs.push({c,dx:Math.random()>.5?1:-1,dy:Math.random()>.5?1:-1})}
    this.self=this.add.circle(560,320,14,0x48d597).setStrokeStyle(3,0xffffff); this.nameText=this.add.text(560,292,'أنت',{fontSize:'13px',color:'#fff',backgroundColor:'#0008',padding:{x:4,y:2}}).setOrigin(.5);
    this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT'); this.lastSend=0;
  }
  update(time,delta){
    if(!this.self) return; let vx=0,vy=0; const k=this.keys; if(k.A.isDown||k.LEFT.isDown)vx=-1;if(k.D.isDown||k.RIGHT.isDown)vx=1;if(k.W.isDown||k.UP.isDown)vy=-1;if(k.S.isDown||k.DOWN.isDown)vy=1;
    if(vx||vy){const len=Math.hypot(vx,vy)||1;this.self.x+=vx/len*3.2;this.self.y+=vy/len*3.2;this.self.x=Phaser.Math.Clamp(this.self.x,20,1180);this.self.y=Phaser.Math.Clamp(this.self.y,20,680);this.nameText.setPosition(this.self.x,this.self.y-28);if(time-this.lastSend>70&&socket.readyState===1){socket.send(JSON.stringify({type:'move',x:this.self.x,y:this.self.y}));this.lastSend=time}}
    for(const n of this.npcs){n.c.x+=n.dx*0.25;n.c.y+=n.dy*0.18;if(n.c.x<30||n.c.x>1170)n.dx*=-1;if(n.c.y<210||n.c.y>660)n.dy*=-1}
    for(const [id,p] of remotes){p.g.x=Phaser.Math.Linear(p.g.x,p.x,0.25);p.g.y=Phaser.Math.Linear(p.g.y,p.y,0.25);p.t.setPosition(p.g.x,p.g.y-26)}
  }
  addRemote(p){if(p.id===selfId)return;if(remotes.has(p.id)){Object.assign(remotes.get(p.id),p);return}const g=this.add.circle(p.x,p.y,13,0x5b8cff).setStrokeStyle(2,0xffffff);const t=this.add.text(p.x,p.y-26,p.name,{fontSize:'12px',color:'#fff',backgroundColor:'#0008',padding:{x:3,y:1}}).setOrigin(.5);remotes.set(p.id,{...p,g,t})}
}
new Phaser.Game({type:Phaser.AUTO,parent:'app',width:1200,height:700,scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Cairo,render:{antialias:true}});

socket.addEventListener('open',()=>addLog('🟢 تم الاتصال بعالم القاهرة'));
socket.addEventListener('close',()=>addLog('🔴 انقطع الاتصال بالسيرفر'));
socket.addEventListener('message',e=>{const m=JSON.parse(e.data); const s=Phaser.GameObjects.GameObjectFactory;
  if(m.type==='welcome'){selfId=m.self.id;selfStats={money:m.self.money,job:m.self.job}; moneyEl.textContent=selfStats.money+' جنيه';jobEl.textContent=selfStats.job; for(const p of m.players) if(p.id!==selfId) document.querySelector('canvas') && window.gameScene?.addRemote?.(p); addLog('👋 أهلاً بك في القاهرة');}
  else if(m.type==='join'){window.gameScene?.addRemote?.(m.player);addLog('👤 لاعب جديد دخل المدينة');}
  else if(m.type==='move'){const p=remotes.get(m.player.id);if(p){p.x=m.player.x;p.y=m.player.y}else window.gameScene?.addRemote?.(m.player)}
  else if(m.type==='leave'){const p=remotes.get(m.id);if(p){p.g.destroy();p.t.destroy();remotes.delete(m.id)}addLog('🚶 لاعب غادر المدينة')}
  else if(m.type==='chat'){addLog(`💬 ${m.from}: ${m.text}`)}
  else if(m.type==='stats'){selfStats.money=m.money;selfStats.job=m.job;moneyEl.textContent=m.money+' جنيه';jobEl.textContent=m.job;addLog('✨ '+m.notice)}
  else if(m.type==='notice')addLog('ℹ️ '+m.notice);
});
setInterval(()=>{const sc=Phaser.GAMES[0]?.scene.getScene('Cairo'); if(sc) window.gameScene=sc},200);

document.getElementById('work').onclick=()=>socket.readyState===1&&socket.send(JSON.stringify({type:'work'}));
document.getElementById('rent').onclick=()=>socket.readyState===1&&socket.send(JSON.stringify({type:'rent'}));
function sendChat(){const el=document.getElementById('msg');if(el.value.trim()&&socket.readyState===1){socket.send(JSON.stringify({type:'chat',text:el.value.trim()}));el.value=''}}
document.getElementById('send').onclick=sendChat;document.getElementById('msg').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat()});
