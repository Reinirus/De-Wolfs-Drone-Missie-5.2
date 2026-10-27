(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('scene'),gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true});
if(!gl){$('error').hidden=false;$('error').textContent='WebGL is niet beschikbaar. Controleer de hardwareversnelling van je browser. De fotosimulator en theorie werken via de knoppen bovenaan.';return;}
const vs=`attribute vec3 position;attribute vec3 normal;attribute vec3 color;uniform mat4 vp;varying vec3 c;varying vec3 world;varying vec3 n;void main(){gl_Position=vp*vec4(position,1.0);world=position;c=color;n=normalize(normal);}`;
const fs=`precision mediump float;
varying vec3 c;varying vec3 world;varying vec3 n;
uniform float elapsed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float lines(float x,float width){return 1.0-smoothstep(width,width+.055,abs(fract(x)-.5));}
void main(){
 vec3 color=c;vec3 nn=normalize(n);float vertical=abs(nn.y);
 // Projected brickwork on vertical planes, with alternate half-brick courses.
 float warmBrick=step(.67,c.r)*step(c.g,.76)*step(.20,c.g)*step(c.b,.61);
 if(warmBrick>.5 && vertical<.7){
   float course=floor(world.y*2.3);
   float coord=abs(nn.x)>abs(nn.z)?world.z:world.x;
   float mortar=max(step(fract(world.y*2.3),.065),step(fract((coord+(mod(course,2.0)*.48))*1.06),.945));
   float grain=hash(floor(vec2(coord*1.06,world.y*2.3)));
   color=mix(color*(.86+grain*.21),vec3(.93,.85,.72),mortar*.76);
 }
 // Roof slate and terracotta tile rows, with subtle alternating shingles.
 float roofRed=step(.46,c.r)*step(c.g,.44)*step(c.b,.35);
 if(roofRed>.5 && vertical>.10){
   float row=fract(world.z*2.5+world.y*.65);
   float seam=1.0-smoothstep(.025,.065,row);
   float offset=mod(floor(world.z*2.5+world.y*.65),2.0)*.5;
   float joint=1.0-smoothstep(.012,.045,fract(world.x*1.4+offset));
   color *= 1.04-.23*max(seam,joint*.52);
 }
 // Grass: subtle natural color variation, without a tiled image.
 float grass=step(.21,c.g)*step(c.r,c.g*.93)*step(c.b,c.g*.88)*step(.78,vertical);
 if(grass>.5){float grain=hash(floor(world.xz*2.0));float broad=sin(world.x*.29+sin(world.z*.2))*sin(world.z*.24);color*=.89+grain*.18+broad*.055;}
 // Rippling turquoise river surface.
 float water=step(.65,c.b)*step(.56,c.g)*step(c.r,.44)*step(.78,vertical);
 if(water>.5){float ripple=sin(world.x*1.9+elapsed*1.7+sin(world.z*.7))*sin(world.z*2.9-elapsed*1.25);color+=vec3(.07,.10,.12)*(.30+.30*ripple);}
 // Road: granular asphalt and delicate lane edge lighting.
 float road=step(c.r,.20)*step(c.g,.22)*step(c.b,.29)*step(.8,vertical);
 if(road>.5)color*=.88+.20*hash(floor(world.xz*5.));
 vec3 sun=normalize(vec3(-.50,.85,.60));float diffuse=max(dot(nn,sun),0.);
 float skylight=.41+.17*max(nn.y,0.);
 vec3 lit=color*(skylight+.53*diffuse);
 // Warm late-afternoon sunlight and cool skylight; physically simplified, but directional.
 lit+=color*vec3(.06,.04,.01)*diffuse;
 gl_FragColor=vec4(clamp(lit,0.,1.),1.);
}`;
function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);const ap=gl.getAttribLocation(program,'position'),an=gl.getAttribLocation(program,'normal'),ac=gl.getAttribLocation(program,'color'),uvp=gl.getUniformLocation(program,'vp'),ut=gl.getUniformLocation(program,'elapsed');let buf=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.clearColor(.42,.77,1.0,1);
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function sub(a,b){return a.map((v,i)=>v-b[i])}function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}function norm(a){let l=Math.hypot(...a)||1;return a.map(v=>v/l)}function dot(a,b){return a.reduce((s,v,i)=>s+v*b[i],0)}
function look(eye,target,up){let z=norm(sub(eye,target)),x=norm(cross(up,z)),y=cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]}
function perspective(fov,aspect,n,f){let q=1/Math.tan(fov/2);return[q/aspect,0,0,0,0,q,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0]}
function mul(a,b){let c=Array(16).fill(0);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c}
let v=[];function tri(a,b,c,col){let normal=norm(cross(sub(b,a),sub(c,a)));for(let p of [a,b,c])v.push(...p,...normal,...col)}
function quad(a,b,c,d,col){tri(a,b,c,col);tri(a,c,d,col)}
function cube(x,y,z,w,h,d,col){let X=x-w/2,Y=y,Z=z-d/2;let a=[X,Y,Z],b=[X+w,Y,Z],c=[X+w,Y,Z+d],dd=[X,Y,Z+d],e=[X,Y+h,Z],f=[X+w,Y+h,Z],g=[X+w,Y+h,Z+d],hh=[X,Y+h,Z+d];quad(a,dd,c,b,col.map(q=>q*.72));quad(e,f,g,hh,col);quad(a,b,f,e,col.map(q=>q*.82));quad(b,c,g,f,col.map(q=>q*.65));quad(c,dd,hh,g,col.map(q=>q*.78));quad(dd,a,e,hh,col.map(q=>q*.92))}
function cylinder(x,y,z,r,h,col,n=9){for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;let p=[x+r*Math.cos(a),y,z+r*Math.sin(a)],q=[x+r*Math.cos(b),y,z+r*Math.sin(b)],p2=[p[0],y+h,p[2]],q2=[q[0],y+h,q[2]];quad(p,q,q2,p2,col);tri([x,y+h,z],p2,q2,col)}}
function beam(a,b,r,col){let d=sub(b,a),len=Math.hypot(...d),mid=a.map((k,i)=>(k+b[i])/2); // solid beam aligned predominantly in x/y/z
 if(Math.abs(d[1])>Math.abs(d[0])&&Math.abs(d[1])>Math.abs(d[2]))cube(mid[0],Math.min(a[1],b[1]),mid[2],r,len,r,col);else if(Math.abs(d[0])>Math.abs(d[2]))cube(mid[0],mid[1]-r/2,mid[2],len,r,r,col);else cube(mid[0],mid[1]-r/2,mid[2],r,r,len,col)}
const C={grass:[.43,.83,.31],water:[.30,.81,.97],road:[.095,.12,.18],stone:[.76,.75,.68],brick:[.92,.48,.31],roof:[.74,.20,.16],wood:[.42,.27,.18],leaf:[.14,.55,.26],leaf2:[.34,.70,.25],white:[.99,.97,.87],gold:[1,.75,.24],cyan:[.13,.84,.88],red:[.95,.28,.25],bridge:[.72,.78,.82],cream:[.99,.81,.46],terracotta:[.93,.43,.27],blue:[.26,.62,.83],flowers:[.97,.71,.31]};
// Decorative primitives for the standalone WebGL renderer. These do not alter flight physics.
function wallPattern(x,y,z,w,h,front=true){
 // Brick mortar is actual geometry, not a decal pasted on the image.
 const zz=z+(front?.105:-.105);
 for(let level=.42;level<h;level+=.53){
  cube(x,y+level,z,w,.034,.045,[.96,.86,.73]);
  let offset=(Math.round(level/.53)%2)*.52;
  for(let u=-w/2+.20+offset;u<w/2;u+=1.04)cube(x+u,y+level-.24,zz,.028,.42,.055,[.96,.84,.72]);
 }
}
function gableRoof(x,y,z,w,d,h,col){
 const a=x-w/2-.38,b=x+w/2+.38,lo=y+.02,hi=y+h;
 quad([a,lo,z-d/2-.43],[x,hi,z-d/2-.43],[x,hi,z+d/2+.43],[a,lo,z+d/2+.43],col);
 quad([x,hi,z-d/2-.43],[b,lo,z-d/2-.43],[b,lo,z+d/2+.43],[x,hi,z+d/2+.43],col);
 tri([a,lo,z+d/2+.41],[b,lo,z+d/2+.41],[x,hi,z+d/2+.41],[.90,.77,.58]);
 tri([b,lo,z-d/2-.41],[a,lo,z-d/2-.41],[x,hi,z-d/2-.41],[.90,.77,.58]);
 const tile=col.map(t=>Math.min(1,t*1.25));
 for(let j=0;j<7;j++){
  let zz=z-d/2+j*d/6;
  let yy=lo+(hi-lo)*(j%2)*.008;
  // tile courses follow the roof slope; triangles form a convincing red construction
  for(let k=1;k<7;k++){
   let t=k/7,xx=a+(x-a)*t,xx2=b+(x-b)*t,ht=lo+(hi-lo)*t+.018;
   beam([xx,ht,zz],[xx,ht,zz+d/8],.055,k%2?tile:col);
   beam([xx2,ht,zz],[xx2,ht,zz+d/8],.055,k%2?tile:col);
  }
 }
 cube(x,hi-.04,z, .14,.14,d+.9,[.33,.18,.18]);
}
function windowsOnSide(x,y,z,w,d,h){
 for(let sy of [-1,1])for(let zz=z-d*.29;zz<=z+d*.3;zz+=d*.56){
  const sideX=x+sy*(w/2+.12);
  cube(sideX,1.6,zz,.13,1.65,1.15,[.98,.94,.81]);
  cube(sideX+sy*.08,1.77,zz,.07,1.32,.85,[.19,.49,.65]);
  cube(sideX+sy*.17,2.35,zz,.06,.09,1.17,[.99,.96,.86]);
  cube(sideX+sy*.17,1.69,zz,.06,.08,1.17,[.99,.96,.86]);
 }
}
function shopCanopy(x,z,w,shop){
 const isShop=shop==='WINKEL';const fabric=isShop?[.98,.68,.19]:[.27,.73,.68];
 cube(x,3.20,z+4.8,w-.75,.22,2.2,fabric);
 for(let i=0;i<8;i++)cube(x-w/2+.9+i*(w-1.5)/8,3.01,z+5.75,(w-1.5)/12,.20,.20,isShop?C.white:C.cream);
 // Signboard has a dimensional frame; live text label supplied by HTML overlay.
 cube(x,3.5,z+4.67,w-1.1,.9,.20,isShop?[.22,.48,.68]:[.67,.21,.17]);
 cube(x,3.62,z+4.79,w-1.5,.10,.065,C.white);
}
function houseDetailed(x,z,h=6,w=10,d=9,shop=''){
 const tone=((Math.abs(Math.round(x*3+z))%5));
 const walls=[C.brick,C.cream,[.99,.78,.55],[.90,.88,.76],[.82,.66,.55]][tone];
 cube(x,-.23,z,w+1.5,.05,d+1.5,[.26,.42,.29]);
 cube(x,0,z,w,h,d,walls);
 // Mortar relief on both long walls and front facade.
 wallPattern(x,0,z+d/2,w,h,true);
 for(let side of [-1,1]){let wallX=x+side*w/2;for(let yy=.65;yy<h;yy+=.56)cube(wallX+side*.04,yy,z,.06,.035,d,[.98,.89,.77]);}
 gableRoof(x,h,z,w,d,Math.max(2.15,h*.39),tone===1?[.24,.29,.35]:C.roof);
 for(let zz of [z-d*.33,z+d*.33])cube(x+2.3,h+1,z-.1,.95,2.45,1.1,[.66,.37,.26]);
 cube(x,0,z+d/2+.15,w,.27,.18,[.63,.44,.33]);
 for(let yy=1.5;yy<h-.4;yy+=2.38){
  for(let xx of [-w*.29,w*.29]){
   const front=z+d/2;
   cube(x+xx,yy,front+.14,1.60,1.63,.18,[.99,.97,.89]);
   cube(x+xx,yy,front+.25,1.27,1.28,.09,[.18,.48,.64]);
   cube(x+xx,yy+.58,front+.35,1.46,.08,.065,C.white);
   cube(x+xx,yy,front+.36,.09,1.43,.065,C.white);
   cube(x+xx,yy-.82,front+.34,1.85,.12,.25,[.87,.83,.75]);
  }
 }
 windowsOnSide(x,0,z,w,d,h);
 cube(x,0,z+d/2+.25,1.64,2.45,.28,shop?[.21,.37,.43]:[.36,.25,.20]);
 cube(x+.48,1.20,z+d/2+.45,.12,.13,.10,C.gold);
 for(let yy=.42;yy<2.35;yy+=.55)cube(x,yy,z+d/2+.43,1.22,.04,.055,[.65,.55,.43]);
 if(shop)shopCanopy(x,z,w,shop);
 // Flower garden and pavement establish a real street edge.
 cube(x,-.085,z+d/2+2.0,w+2,.15,2.8,[.82,.77,.65]);
 for(let i=-2;i<=2;i++){
  let xx=x+i*(w/5);cube(xx,.09,z+d/2+1.9,.25,.3,.28,C.leaf2);
  cube(xx,.36,z+d/2+1.9,.18,.15,.18,i%2?C.gold:C.red);
 }
}
function pointedRoof(x,y,z,w,d,h,col){gableRoof(x,y,z,w,d,h,col)}
function treeDetailed(x,z,h,time,i){
 cylinder(x,0,z,.55,h*.7,C.wood,8);
 // Three overlapping foliage volumes visibly rotate/wave, leaving the trunk rooted.
 const sway=Math.sin(time*1.2+i*2.3)*.24;
 cylinder(x,-.20,z,2.25,.045,[.30,.48,.30],14);
 for(let k=0;k<3;k++)cylinder(x+sway*(k+1)/3,h*.47+k*.9,z+sway*.55,2.0-k*.22,h*.42,k%2?C.leaf:C.leaf2,10);
}
function cloud3(x,y,z){for(let i=0;i<5;i++)cylinder(x+(i-2)*2.0,y+Math.sin(i*1.6)*.55,z,2.45,1.15,C.white,10)}
function skyDecor(time){
 // Sun + drifting clouds are rendered as distant 3D geometry against the blue clear color.
 cylinder(-62,48,-88,5,1.2,[1,.86,.23],20);
 for(let i=0;i<4;i++)cloud3(-60+i*30+Math.sin(time*.075+i)*5,39+i%2*6,-78+(i%2)*12);
}
function dashedRoad(x,z,w,d){cube(x,-.15,z,w+1.6,.08,d+1.6,[.65,.67,.64]);cube(x,-.12,z,w,.12,d,C.road);if(d>=w){for(let zz=z-d/2+3;zz<z+d/2-2;zz+=8)cube(x,-.038,zz,.18,.025,3,C.white);for(let side of [-1,1])cube(x+side*(w/2-.28),-.036,z,.12,.025,d-.5,C.white);}else{for(let xx=x-w/2+3;xx<x+w/2-2;xx+=8)cube(xx,-.038,z,3,.025,.18,C.white);for(let side of [-1,1])cube(x,-.036,z+side*(d/2-.28),w-.5,.025,.12,C.white);}}
let pos={x:0,y:0,z:66},yaw=Math.PI,turnPractice=false,mode=0,camYaw=0,camPitch=0,air=false,landing=false,rth=false,done=false,progress=0,battery=100,score=0,keys=new Set(),last=0,seed=0;
let rings=[{x:0,y:7,z:43,label:'Brug naderen'},{x:0,y:4.1,z:16,label:'Onder de brug'},{x:38,y:11,z:-8,label:'Rond molen'},{x:38,y:12,z:-35,label:'Kerk observeren'},{x:0,y:7,z:-57,label:'Tussen bomen'}];

const MISSIONS=[
 ['Kerk en toren','Maak een rondvlucht langs kerk, toren en dak. Houd afstand.',[[0,7,42],[12,11,-16],[44,14,-34],[26,15,-54],[8,10,-39]],[['Kerktoren',26,23,-43],['Kerkdak',26,14,-35],['Voorgevel',26,5,-24]]],
 ['Plein en bedrijven','Inspecteer het plein; maak beelden van winkel, restaurant en plein.',[[0,7,42],[-18,9,14],[-34,10,-8],[5,11,-24],[29,9,-39]],[['Winkel',-22,3,-18],['Restaurant',22,3,-18],['Plein',0,1,-17]]],
 ['Mensen en straten','Vluchtbeslissing: vermijd mensenmenigte, fotografeer op veilige afstand.',[[0,7,42],[-15,9,16],[-27,9,-5],[-18,10,-27],[3,9,-49]],[['Voetgangerszone',-33,3,-20],['Straat',42,3,-26]]],
 ['Stad en skyline','Maak een stadsroute met foto’s van gebouwen, kerk en skyline.',[[0,9,40],[-23,12,15],[-29,14,-10],[3,16,-34],[28,15,-49]],[['Stadsgezicht',-45,10,-12],['Kerk',26,15,-35],['Huizenrij',47,5,-20]]],
 ['Rivieren','Vlieg langs het water en fotografeer rivier, oever en brug.',[[0,8,42],[0,9,26],[0,9,2],[0,9,-23],[0,8,-47]],[['Rivier',0,2,28],['Oever',-16,3,0],['Brug',0,7,17]]],
 ['Straten en huizen','Stuur tussen de huizen door en maak twee gebiedsfoto’s.',[[0,8,40],[-11,8,14],[-20,9,-4],[0,9,-27],[10,9,-50]],[['Huizen links',-45,5,19],['Huizen rechts',47,5,-20],['Straat',42,3,-26]]],
 ['Bijzondere gebouwen','Fotografeer drie verschillende architectonische objecten.',[[0,8,40],[20,11,15],[40,12,-8],[35,15,-36],[8,10,-49]],[['Molen',28,12,-8],['Kerk',26,18,-35],['Historisch gebouw',-45,6,-20]]],
 ['Bruggen','Vlieg langs, over en in de fictieve oefening onder de brug.',[[0,8,43],[0,4.1,16],[0,11,2],[-20,10,-17],[0,8,-43]],[['Brugdek',0,7,17],['Onderzijde',0,4,17],['Rivier',0,2,29]]],
 ['Molens','Vlieg een 360°-route rondom de molen en fotografeer verschillende kanten.',[[45,11,-8],[28,11,9],[11,11,-8],[28,11,-25],[43,12,-18]],[['Molen voorzijde',28,9,-2],['Wieken',28,16,-4],['Molen zijkant',28,9,-15]]],
 ['Bos en paden','Vlieg langs bospaadjes, tussen bomen en hoog boven de fictieve bosrand.',[[0,8,34],[0,8,10],[0,8,-17],[0,9,-43],[0,14,-67]],[['Bos links',-10,7,-49],['Bos rechts',10,7,-65],['Bospad',0,3,-58]]]
];
const missionPhoto=['church_aerial2.jpg','square2.jpg','crowd_square.jpg','old_street2.jpg','river.jpg','street_row.jpg','church_does2.jpg','bridge_under.jpg','mill_main.jpg','forest_b.jpg'];
const home={x:0,z:66};

let missionId=0,free=false,shots=new Set(),flightSeconds=0,flightStarted=false,stage='idle',rthPhase='idle',rthTargetAltitude=12;
const recordsKey='dewolf-missie-v43';
function records(){try{return JSON.parse(localStorage.getItem(recordsKey)||'{}')}catch{return {}}}
function saveRecords(v){try{localStorage.setItem(recordsKey,JSON.stringify(v))}catch{}}
function recalc(){let rr=records();let sum=Object.values(rr).reduce((s,r)=>s+(r.points||0),0);$('totalScore').textContent='Totaal: '+sum+' punten · '+Object.keys(rr).length+'/10 missies voltooid';$('freeFlight').disabled=Object.keys(rr).length<10;$('missionSelect').options[$('missionSelect').options.length-1].disabled=Object.keys(rr).length<10;$('freeFlight').textContent=Object.keys(rr).length===10?'🌍 Vrije vliegwereld openen':'🔒 Vrij vliegen na 10 missies';$('missionResults').innerHTML=MISSIONS.map((m,i)=>'<div>'+ (rr[i]?'✅':'○')+' '+(i+1)+'. '+m[0]+' — '+(rr[i]?rr[i].points+' pt / '+rr[i].time:'nog niet voltooid')+'</div>').join('');}
function fmtTime(s){s=Math.floor(s);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function loadMission(){free=$('missionSelect').value==='free';missionId=free?-1:Number($('missionSelect').value);reset();if(!free){let m=MISSIONS[missionId];rings=m[2].map(([x,y,z],i)=>({x,y,z,label:'Controlepunt '+(i+1)}));$('missionBrief').textContent=m[1]+' Fotografeer: '+m[3].map(t=>t[0]).join(', ');$('mission').textContent='MISSIE '+(missionId+1)+' · '+m[0];$('missionImage').src='assets/'+missionPhoto[missionId];}else{rings=[];$('missionBrief').textContent='Vrije wereld: alle objecten, onbeperkt verkennen en fotograferen.';$('mission').textContent='VRIJE VLIEGWERELD';$('missionImage').src='assets/pilot.jpg';} $('photoStatus').textContent='Fotodoelen 0/'+(free?'vrij':MISSIONS[missionId][3].length);$('gallery').replaceChildren();$('timer').textContent='Tijd 00:00';updatePhotoGuide();recalc();}
// Each objective has a physical vantage point. Overhead targets need a nadir camera and
// a drone centered above the actual object, not merely within a generic distance.
const photoRules={
  0:[['side',26,23,-43,14],['roof',26,14,-35,7,32],['side',26,5,-24,18]],
  1:[['side',-22,3,-13.4,21],['side',22,3,-13.4,21],['roof',0,1,-17,15,13]],
  2:[['side',-33,3,-20,20],['roof',42,3,-26,9,13]],
  3:[['wide',-28,10,-12,34],['side',26,15,-35,25],['roof',47,7,-20,8,13]],
  4:[['roof',0,1,28,15,10],['roof',-16,1,0,11,10],['side',0,7,17,23]],
  5:[['roof',-45,7,19,8,13],['roof',47,7,-20,8,13],['roof',42,1,-26,7,11]],
  6:[['side',28,12,-8,21],['side',26,18,-35,25],['side',-45,6,-20,22]],
  7:[['roof',0,8,17,12,13],['side',0,5,17,16],['roof',0,1,29,12,11]],
  8:[['side',28,9,-2,20],['side',28,16,-4,21],['side',28,9,-15,20]],
  9:[['side',-10,7,-49,20],['side',10,7,-65,20],['roof',0,1,-58,9,12]]
};
function photoCheck(rule){
 const [kind,x,y,z,r,minAlt]=rule;const dx=x-pos.x,dz=z-pos.z,dist=Math.hypot(dx,dz);
 if(kind==='roof'){
   if(dist>r) return 'Vlieg boven het aangegeven foto-object (nog '+Math.ceil(dist-r)+' m dichterbij).';
   if(pos.y<minAlt) return 'Stijg tot minstens '+minAlt+' m en hang boven het doel.';
   if(mode!==3) return 'Kies camera 4 (90° omlaag) voor deze dak- of overzichtsfoto.';
   return '';
 }
 if(dist>r) return 'Vlieg dichter bij het doel: nog '+Math.ceil(dist-r)+' m.';
 if(Math.abs(pos.y-y)>12) return pos.y>y?'Daal een stukje om het onderwerp beter te kaderen.':'Stijg hoger om het onderwerp te fotograferen.';
 if(mode===3) return 'Schakel naar FPV-camera (toets 2) en richt de neus op het onderwerp.';
 let target=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(target-yaw),Math.cos(target-yaw));
 if(Math.abs(delta)>.62) return 'Draai de neus/camera richting het foto-object met A of D.';
 return '';
}
function photograph(){
 if(!air||done){updateHud('Stijg eerst op om een foto te maken.');return;}
 if(rth||landing){updateHud('Foto niet gemaakt: wacht tot RTH of de landing klaar is.');return;}
 const objectives=free?[]:MISSIONS[missionId][3];
 let candidate=-1,feedback='';
 if(!free){
   for(let i=0;i<objectives.length;i++){
     if(shots.has(i))continue;
     let issue=photoCheck(photoRules[missionId][i]);
     if(!issue){candidate=i;break;}
     // Select the nearest outstanding objective to give a meaningful hint.
     if(!feedback) feedback=objectives[i][0]+': '+issue;
   }
   if(candidate<0){updateHud('📷 Nog niet goed: '+feedback+' De vlucht gaat gewoon verder.');return;}
 }
 // Capture first; only award the objective after a valid canvas image exists.
 let c=document.createElement('canvas');c.width=320;c.height=180;
 try{let ctx=c.getContext('2d');if(!ctx)throw new Error('Geen foto-canvas');ctx.drawImage(canvas,0,0,c.width,c.height);}catch(e){updateHud('Foto kon niet worden opgeslagen. Blijf vliegen en probeer het opnieuw.');return;}
 let d=document.createElement('div');d.className='shot';d.append(c);
 let caption=document.createElement('small');caption.textContent=free?'Vrije foto '+($('gallery').children.length+1):objectives[candidate][0]+' ✓';d.append(caption);$('gallery').append(d);
 if(!free){shots.add(candidate);score+=40;}
 $('score').textContent='Score: '+score;$('photoStatus').textContent='Fotodoelen '+shots.size+'/'+(free?'vrij':objectives.length);
 updatePhotoGuide();updateHud('📸 Foto opgeslagen: '+caption.textContent);
}
function updatePhotoGuide(){
 const node=$('photoGuide');if(!node)return;
 if(free){node.textContent='Vrij vliegen: kies je camerahoek en maak eigen opnamen.';return;}
 const q=MISSIONS[missionId][3];node.replaceChildren();
 q.forEach((objective,i)=>{let row=document.createElement('div');let rule=photoRules[missionId][i];row.textContent=(shots.has(i)?'✓ ':'○ ')+objective[0]+' — '+(rule[0]==='roof'?'boven doel hangen, minimaal '+rule[5]+' m; camera 4 naar beneden':rule[0]==='wide'?'afstand houden en met FPV op onderwerp richten':'op het onderwerp richten met FPV-camera (2)');node.append(row);});
}

let blocks=[];function obstacle(x,z,w,d,h,type){blocks.push({x,z,w,d,h,type})}
function makeWorld(time){v=[];cube(0,-.38,0,190,.36,190,C.grass);for(let j=0;j<9;j++)cube(-85+j*20,-.193,-75,17,.012,25,j%2?[.32,.67,.28]:[.38,.73,.30]);skyDecor(time);
 // bright stylised neighbourhood details: flowerbeds, path and paving
 for(let i=0;i<14;i++){let zz=53-i*8;if(zz<-59)break;cube(-61,-.13,zz,3,.12,4,i%2?C.leaf2:C.leaf);for(let k=0;k<4;k++)cube(-61+(k-1.5)*.5,-.005,zz+(k%2-.5)*1,.3,.18,.3,i%3?C.flowers:C.red)}
 // Garden parcels, pavements, zebra crossing and visually bounded roads.
 for(let side of [-1,1]){
  cube(side*37,-.11,9,3,.13,98,[.84,.79,.69]);
  cube(side*40,-.075,9,2.3,.1,98,[.63,.72,.53]);
  for(let i=0;i<9;i++){
   let z=37-i*13;
   cube(side*39,.12,z,1.8,.25,.9,C.leaf2);
   for(let j=0;j<3;j++)cube(side*(38.6+j*.35),.30,z+.18,.16,.13,.16,[C.red,C.gold,C.cream][j]);
  }
 }
 for(let i=0;i<8;i++)cube(39+i*.85,-.006,16, .42,.022,3.4,C.white);
 for(let i=0;i<8;i++)cube(39+i*.85,-.006,-44, .42,.022,3.4,C.white);
 const all=free, id=missionId;
 const bridge=all||[4,7].includes(id), mill=all||[6,8].includes(id), church=all||[0,3,6].includes(id),forest=all||id===9, town=all||[1,2,3,5,6].includes(id), river=all||[4,7].includes(id), people=all||[1,2].includes(id);
 if(river){cube(0,-.18,18,30,.18,150,C.water);for(let zz=-48;zz<86;zz+=9)cube(Math.sin(time*.9+zz)*4,-.067,zz,4,.014,.10,[.65,.88,.98]);}
 if(town){dashedRoad(42,-26,10,120);dashedRoad(0,26,110,9);for(let zz=-75;zz<=37;zz+=18){cube(35,-.07,zz,3,.15,1.7,C.white);cube(49,-.07,zz,3,.15,1.7,C.white)}}
 if(id===1||id===2||free){cube(0,-.15,-17,49,.15,44,C.stone);houseDetailed(-22,-18,5,9,9,'WINKEL');houseDetailed(22,-18,5,9,9,'RESTAURANT');cube(-22,4.1,-13.4,8,.85,.18,C.gold);cube(22,4.1,-13.4,8,.85,.18,C.white);}
 if(people)for(let i=0;i<10;i++){let x=-12+(i%5)*5+Math.sin(time*.65+i)*.45,z=-20+Math.floor(i/5)*7+Math.cos(time*.55+i)*.5;
 const shirts=[C.gold,C.blue,C.red,C.cream,C.leaf2];cylinder(x,0,z,.28,1.65,shirts[i%5],9);cylinder(x,1.68,z,.24,.37,[.72,.48,.31],9);cube(x,0,z,.18,.68,.12,C.road);}


 if(bridge){ // bridge: horizontal deck at y=6.5; pillars at x+-12, opening underneath the central deck
 cube(0,6.5,17,36,1.1,7,C.bridge);for(let x of [-15.5,15.5]){cube(x,0,17,3.8,6.5,7,C.stone);for(let z of [14,20])cube(x,6.9,z,.22,2.5,.25,C.bridge)}
 for(let x=-17;x<=17;x+=3.4){cube(x,7.5,13.5,.18,1.9,.2,C.bridge);cube(x,7.5,20.5,.18,1.9,.2,C.bridge)}cube(0,9.1,13.5,35,.2,.2,C.bridge);cube(0,9.1,20.5,35,.2,.2,C.bridge);
 } if(mill){ // full 3D mill body, roof and rotating four arms; centered at x28,z-8
 cylinder(28,0,-8,5,16,C.wood,12);cylinder(28,16,-8,5.7,3,C.roof,12);cube(28,3,-2.9,2.3,4,.2,C.white);let a=time*.4;for(let i=0;i<4;i++){let t=a+i*Math.PI/2,ex=28+Math.sin(t)*10,ey=14+Math.cos(t)*10;let dx=ex-28,dy=ey-14;let perp=[-dy/Math.hypot(dx,dy)*.9,dx/Math.hypot(dx,dy)*.9];quad([28+perp[0],14+perp[1],-2.5],[ex+perp[0],ey+perp[1],-2.5],[ex-perp[0],ey-perp[1],-2.5],[28-perp[0],14-perp[1],-2.5],C.white)}
 } if(church){ // church, front walls, high tower, roof and windows
 cube(26,0,-35,13,11,20,C.brick);pointedRoof(26,11,-35,14,21,4,C.roof);cube(26,0,-43,5,25,5,C.brick);pointedRoof(26,25,-43,6,6,3.4,C.roof);for(let z of [-42,-36,-30])for(let x of [19.4,32.6]){cube(x,4,z,.12,3,1,C.white);cube(x+(x<26?-.08:.08),4.4,z,.04,2.1,.65,[.17,.35,.48]);}wallPattern(26,0,-24.96,12,9);for(let side of [-1,1]){let x=26+side*2.60;cube(x,20.2,-40.39,.12,3.2,2.65,C.white);cube(x+side*.09,20.2,-40.39,.08,2.8,2.3,[.12,.22,.31]);}cylinder(26,20.3,-40.3,1.42,.10,C.white,24);cylinder(26,20.3,-40.22,1.12,.10,C.gold,24);for(let i=0;i<12;i++){let a=i*Math.PI/6;cube(26+Math.sin(a)*1.1,20.3+Math.cos(a)*1.1,-40.07,.16,.16,.08,C.road)}beam([26,20.35,-40.1],[26,21.04,-40.1],.10,C.road);beam([26,20.35,-40.1],[26.54,20.0,-40.1],.09,C.road);
 } if(forest){ // forest: trunks + varied foliage
 for(let i=0;i<26;i++){let side=i%2?-10:10;let x=side+Math.sin(i*4.1)*3,z=-44-Math.floor(i/2)*4;let h=5+(i%4)*1.2;treeDetailed(x,z,h,time,i)}
 } if(town){ // houses along outer edge
 for(let i=0;i<(free||[1,2,3,5,6].includes(missionId)?11:0);i++){let x=i%2?-45:47,z=39-Math.floor(i/2)*20;houseDetailed(x,z,5+i%3,10,9)}
 } // H landing pad and bright vertical beacon
 cube(0,-.05,66,10,.12,10,C.cyan);cube(-1.4,.09,66,.45,.02,5,C.white);cube(1.4,.09,66,.45,.02,5,C.white);cube(0,.09,66,3,.02,.48,C.white);cylinder(0,.05,66,.18,11,C.cyan,8);
 // checkpoint rings in vertical x-y plane
 for(let i=progress;i<rings.length;i++){let r=rings[i],col=i===progress?C.gold:C.cyan;for(let j=0;j<28;j++){let a=j/28*Math.PI*2,b=(j+1)/28*Math.PI*2;let aa=[r.x+3*Math.cos(a),r.y+3*Math.sin(a),r.z],bb=[r.x+3*Math.cos(b),r.y+3*Math.sin(b),r.z];beam(aa,bb,.14,col)}}
 // Distinct nose and rotor markers rotate with drone yaw; translation and yaw are independent.
 let {x,y,z}=pos;cube(x,y-.13,z,1.25,.32,.7,C.white);let fx=Math.sin(yaw),fz=Math.cos(yaw),sx=Math.cos(yaw),sz=-Math.sin(yaw);cube(x+fx*.65,y-.20,z+fz*.65,.38,.25,.38,C.roof);cube(x+fx*.89,y-.09,z+fz*.89,.20,.13,.20,C.gold);beam([x+fx*.35,y+.24,z+fz*.35],[x+fx*1.65,y+.24,z+fz*1.65],.10,C.gold);cube(x+fx*1.73,y+.18,z+fz*1.73,.32,.18,.32,C.red);for(let side of [-1,1])for(let fore of [-1,1]){let rx=x+sx*side*.86+fx*fore*.48, rz=z+sz*side*.86+fz*fore*.48;cylinder(rx,y-.05,rz,.30,.10,C.roof,9);cube(rx,y-.22,rz,.12,.2,.12,C.stone);let spin=time*23+(fore*side);for(let blade=0;blade<2;blade++){let a=spin+blade*Math.PI/2,ux=Math.cos(a)*.47,uz=Math.sin(a)*.47;beam([rx-ux,y+.09,rz-uz],[rx+ux,y+.09,rz+uz],.07,[.65,.78,.82]);}}
}
function upload(){let data=new Float32Array(v);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);for(let [at,off] of [[ap,0],[an,12],[ac,24]]){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,3,gl.FLOAT,false,36,off)}gl.drawArrays(gl.TRIANGLES,0,data.length/9)}
function updateHud(s){$('banner').textContent=s;$('coach').textContent=s}
function reset(){shots.clear();flightSeconds=0;flightStarted=false;stage='idle';rthPhase='idle';rthTargetAltitude=12;pos={x:0,y:0,z:66};yaw=Math.PI;air=false;landing=false;rth=false;turnPractice=false;done=false;progress=0;battery=100;score=0;seed++;keys.clear();$('flightState').textContent='Gereed · home 0 m';$('progress').textContent='0/5 controlepunten';$('target').textContent='Doel: controlepunt 1';$('score').textContent='Score: 0';updateHud('Kies OPSTIJGEN. Vlieg door de vijf ringen.');}
function crash(reason){stage='failed';air=false;done=true;landing=false;rth=false;keys.clear();$('flightState').textContent='Vlucht gestopt';updateHud('MISLUKT: '+reason+' · kies Nieuwe vlucht.');}
function touchDown(){let d=Math.hypot(pos.x,pos.z-66);air=false;done=true;landing=false;rth=false;stage='landed';keys.clear();pos.y=0;let completed=free||progress===5, photosDone=free||shots.size===MISSIONS[missionId][3].length;if(d<=5.1&&completed&&photosDone){score+=100;let bonus=Math.max(0,300-Math.floor(flightSeconds*1.5));score+=bonus;updateHud('✓ VOLTOOID! Veilig geland · tijd '+fmtTime(flightSeconds)+' · tijdbonus '+bonus+' · totaal '+score);$('flightState').textContent='✓ Missie voltooid';if(!free){let rr=records();if(!rr[missionId]||score>rr[missionId].points){rr[missionId]={points:score,time:fmtTime(flightSeconds),pilot:$('pilotName').value.trim().slice(0,30)||'Piloot'};saveRecords(rr)}recalc();}}else if(d<=5.1){let missing=free?'':(5-progress)+' controlepunten en '+(MISSIONS[missionId][3].length-shots.size)+' foto’s';updateHud('✓ VEILIG GELAND, maar missie niet compleet: '+missing);$('flightState').textContent='Veilig geland · oefening onvolledig';}else{updateHud('Landing buiten H: '+d.toFixed(1)+' meter. Probeer RTH of richt op H.');$('flightState').textContent='Buiten H geland';}$('score').textContent='Score: '+score;$('timer').textContent='Tijd '+fmtTime(flightSeconds);}
function tick(dt){if(!air||done)return;flightSeconds+=dt;$('timer').textContent='Tijd '+fmtTime(flightSeconds);battery=Math.max(0,battery-dt*.055);if(!battery){crash('accu leeg');return}
 const f=Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown'));
 const side=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
 const turn=Number(keys.has('a'))-Number(keys.has('d'));
 const homeD=Math.hypot(pos.x,pos.z-66);
 if(rth){
   // Deterministic autonomous RTH, independent of control keys and selected camera.
   const dx=home.x-pos.x,dz=home.z-pos.z,dist=Math.hypot(dx,dz);
   if(rthPhase==='climb'){
     pos.y=Math.min(rthTargetAltitude,pos.y+dt*9);
     if(pos.y>=rthTargetAltitude-.15){pos.y=rthTargetAltitude;rthPhase='travel';updateHud('RTH: terugvliegen naar de H-landingsmat.');}
   } else if(rthPhase==='travel'){
     if(dist>.4){
       const targetYaw=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(targetYaw-yaw),Math.cos(targetYaw-yaw));
       yaw+=clamp(delta,-dt*2.4,dt*2.4);
       const step=Math.min(dist,dt*15);
       pos.x+=dx/dist*step;pos.z+=dz/dist*step;
     }
     if(Math.hypot(home.x-pos.x,home.z-pos.z)<=.4){
       pos.x=home.x;pos.z=home.z;rthPhase='descend';mode=3;keys.clear();updateHud('RTH: boven H. Automatische landing gestart.');
     }
   } else if(rthPhase==='descend'){
     pos.x=home.x;pos.z=home.z;
     pos.y=Math.max(0,pos.y-dt*4.3);
     if(pos.y<=.25){touchDown();return;}
   } else {rthPhase=dist>.4?'travel':'descend';}
 }else{
   yaw+=turn*dt*1.65;
   // Right is physically to the drone's RIGHT, not the reversed cross-vector.
   pos.x+=(Math.sin(yaw)*f-Math.cos(yaw)*side)*dt*8;
   pos.z+=(Math.cos(yaw)*f+Math.sin(yaw)*side)*dt*8;
   pos.y+=(Number(keys.has('w'))-Number(keys.has('s')))*dt*(landing?1.5:5);
 }
 if(landing&&!rth){pos.y-=dt*1.2;if(pos.y<=.35){touchDown();return}}
 let hd=Math.hypot(pos.x,pos.z-66);$('flightState').textContent=rth?'RTH '+({'climb':'STIJGEN','travel':'TERUGVLIEGEN','descend':'LANDEN'}[rthPhase]||rthPhase)+' · nog '+hd.toFixed(1)+' m tot H · '+pos.y.toFixed(1)+' m hoog':landing?'LANDEN · '+hd.toFixed(1)+' m tot H':'In vlucht · H '+hd.toFixed(1)+' m';
 // Landing at or near H is not a crash, including pilot-controlled touchdown.
 if(pos.y<=.20){if(hd<=5.1){touchDown();return}if(landing){touchDown();return}crash('grond geraakt buiten landingszone');return}
 if(rth)return;
 if(Math.abs(pos.x)>95||Math.abs(pos.z)>95||pos.y>110){crash('buiten oefengebied');return}
 if((free||[4,7].includes(missionId))&&Math.abs(pos.x)<18.6&&Math.abs(pos.z-17)<4.2&&pos.y>6.2&&pos.y<8.05){crash('brugdek geraakt');return}
 for(let x of (free||[4,7].includes(missionId)?[-15.5,15.5]:[]))if(Math.abs(pos.x-x)<2.4&&Math.abs(pos.z-17)<4.1&&pos.y<7){crash('brugpijler geraakt');return}
 for(let o of [{x:28,z:-8,r:5.5,h:20,active:free||[6,8].includes(missionId)},{x:26,z:-35,r:9,h:29,active:free||[0,3,6].includes(missionId)}])if(o.active&&Math.hypot(pos.x-o.x,pos.z-o.z)<o.r&&pos.y<o.h){crash('object geraakt');return}
 for(let i=0;i<(free||missionId===9?26:0);i++){let x=(i%2?-10:10)+Math.sin(i*4.1)*3,z=-44-Math.floor(i/2)*4;if(Math.hypot(pos.x-x,pos.z-z)<2.8&&pos.y<10){crash('boom geraakt');return}}
 for(let i=0;i<(free||[1,2,3,5,6].includes(missionId)?11:0);i++){let x=i%2?-45:47,z=39-Math.floor(i/2)*20;if(Math.abs(pos.x-x)<6&&Math.abs(pos.z-z)<5.5&&pos.y<9){crash('huis geraakt');return}}
 let r=rings[progress];if(r&&Math.hypot(pos.x-r.x,pos.y-r.y,pos.z-r.z)<3.5){progress++;score+=50;$('progress').textContent=progress+'/5 controlepunten';$('score').textContent='Score: '+score;$('target').textContent=progress===5?'Ga terug naar H':rings[progress].label;updateHud(progress===5?'Alle punten gehaald! Gebruik RTH en LANDEN.':'Goed! Punt '+progress+' gehaald. Volgende: '+(rings[progress]?.label||'H'));}
}
let lastLabelRefresh=0;function updateSceneLabels(vp){ if(performance.now()-lastLabelRefresh<180)return;lastLabelRefresh=performance.now();
 const layer=$('sceneLabels');if(!layer)return;
 layer.replaceChildren();if(!free&&![1,2].includes(missionId))return;
 const labels=[['WINKEL',-22,4.8,-13.3],['RESTAURANT',22,4.8,-13.3]];
 for(const [name,x,y,z] of labels){
  const w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];if(w<=0)continue;
  const sx=(vp[0]*x+vp[4]*y+vp[8]*z+vp[12])/w,sy=(vp[1]*x+vp[5]*y+vp[9]*z+vp[13])/w;
  if(Math.abs(sx)>1.04||Math.abs(sy)>1.04)continue;
  const el=document.createElement('span');el.className='buildingLabel';el.textContent=name;el.style.left=((sx+1)*50)+'%';el.style.top=((1-sy)*50)+'%';layer.append(el);
 }
}
function render(t){let dt=Math.min(.045,(t-last)/1000||0);last=t;tick(dt);let dpr=Math.min(devicePixelRatio||1,1.6),w=Math.max(1,canvas.clientWidth*dpr|0),h=Math.max(1,canvas.clientHeight*dpr|0);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);let eye,target;let forward=[Math.sin(yaw),0,Math.cos(yaw)];if(mode===0){eye=[pos.x-forward[0]*12,pos.y+5,pos.z-forward[2]*12];target=[pos.x,pos.y+1.2,pos.z]}else if(mode===1){eye=[pos.x,pos.y+.3,pos.z];target=[pos.x+forward[0]*15,pos.y+.3,pos.z+forward[2]*15]}else if(mode===2){eye=[pos.x+Math.sin(camYaw)*14,pos.y+7+camPitch*7,pos.z+Math.cos(camYaw)*14];target=[pos.x,pos.y,pos.z]}else{eye=[pos.x,pos.y+25,pos.z+.001];target=[pos.x,pos.y,pos.z]}if(rth && rthPhase!=='descend'){eye=[home.x+55,47,home.z+58];target=[(pos.x+home.x)/2,Math.max(2,pos.y/2),(pos.z+home.z)/2];}let vp=mul(perspective(Math.PI/3,w/h,.1,600),look(eye,target,mode===3&&(!rth||rthPhase==='descend')?[0,0,-1]:[0,1,0]));gl.uniformMatrix4fv(uvp,false,new Float32Array(vp));gl.uniform1f(ut,t/1000);makeWorld(t/1000);upload();updateSceneLabels(vp);if(t-mapLast>100){drawMiniMap();mapLast=t;}$('heading').textContent='Koers '+((yaw*180/Math.PI%360+360)%360|0)+'°';$('alt').textContent='Hoogte '+pos.y.toFixed(1)+' m';$('battery').textContent='Accu '+Math.floor(battery)+'%';requestAnimationFrame(render)}
$('start').onclick=()=>{if(!done){air=true;flightStarted=true;pos.y=Math.max(2,pos.y);updateHud('Opgestegen. Vlieg naar de eerste ring.')}};$('land').onclick=()=>{if(air&&!done){landing=true;rth=false;mode=3;updateHud('Landing actief: camera recht naar beneden. Stuur naar H.')}};$('rth').onclick=()=>{if(air&&!done){rth=true;rthTargetAltitude=Math.max(12,pos.y);rthPhase=pos.y>=rthTargetAltitude-.15?'travel':'climb';landing=false;keys.clear();mode=2;camYaw=0;camPitch=.35;updateHud('RTH actief: automatische terugvlucht. Kijk naar de afstand tot H in de vluchtstatus.')}};$('restart').onclick=()=>{releaseAllControls();loadMission()};$('photo').onclick=photograph;$('freeFlight').onclick=()=>{if(!$('freeFlight').disabled){$('missionSelect').value='free';loadMission()}};$('missionSelect').onchange=()=>{releaseAllControls();loadMission()};$('turnMission').onclick=()=>{if(!done){turnPractice=true;air=true;pos.y=Math.max(pos.y,8);rth=false;landing=false;updateHud('Draaiend terugvliegen: houd ↑ en A of D tegelijk ingedrukt. Corrigeer zijwaarts met ←/→. RTH draait de neus automatisch richting H.')}};$('cam').onclick=()=>{mode=(mode+1)%4;$('cameraLabel').textContent=['Camera volgen','Camera FPV','Camera vrij','Camera 90° omlaag'][mode]};
const touchKeys=new Map();
function releaseAllControls(){keys.clear();touchKeys.clear();document.querySelectorAll('[data-key]').forEach(b=>b.classList.remove('active'));}
function releasePointer(id){if(touchKeys.has(id)){const btn=touchKeys.get(id);touchKeys.delete(id);const k=btn.dataset.key;if(!Array.from(touchKeys.values()).some(b=>b.dataset.key===k))keys.delete(k);btn.classList.toggle('active',Array.from(touchKeys.values()).includes(btn));}}
addEventListener('keydown',e=>{if(['w','s','a','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){if(!rth)keys.add(e.key);e.preventDefault()}if(e.key.toLowerCase()==='p')photograph();if('1234'.includes(e.key)&&e.key.length===1){mode=+e.key-1;$('cameraLabel').textContent=['Camera volgen','Camera FPV','Camera vrij','Camera 90° omlaag'][mode]}});
addEventListener('keyup',e=>keys.delete(e.key));
addEventListener('blur',releaseAllControls);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAllControls()});
addEventListener('pagehide',releaseAllControls);
document.addEventListener('pointerup',e=>releasePointer(e.pointerId),true);
document.addEventListener('pointercancel',e=>releasePointer(e.pointerId),true);
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();releasePointer(e.pointerId);touchKeys.set(e.pointerId,b);if(!rth)keys.add(b.dataset.key);b.classList.add('active');try{b.setPointerCapture(e.pointerId)}catch(_){}});for(const eventName of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(eventName,e=>releasePointer(e.pointerId));});
let dragging=null;canvas.onpointerdown=e=>{dragging={x:e.clientX,y:e.clientY};mode=2;try{canvas.setPointerCapture(e.pointerId)}catch(_){}};canvas.onpointermove=e=>{if(!dragging)return;camYaw+=(e.clientX-dragging.x)*.008;camPitch=clamp(camPitch+(e.clientY-dragging.y)*.008,-.8,.8);dragging={x:e.clientX,y:e.clientY}};canvas.onpointerup=canvas.onpointercancel=()=>dragging=null;
// Touch safety: a contact cannot hold a direction indefinitely when a mobile browser misses pointerup.
let touchLastSeen=performance.now();
addEventListener('pointerdown',()=>{touchLastSeen=performance.now()},true);
addEventListener('pointermove',()=>{touchLastSeen=performance.now()},true);
setInterval(()=>{if(touchKeys.size&&performance.now()-touchLastSeen>16000)releaseAllControls()},1000);
function drawMiniMap(){let map=$('flightMap');if(!map)return;let c=map.getContext('2d'),w=map.width,h=map.height;if(!c)return;c.clearRect(0,0,w,h);c.fillStyle='#bee3a9';c.fillRect(0,0,w,h);
const px=x=>w/2+x*.85,pz=z=>h/2-z*.62;
c.fillStyle='#6fadd1';c.fillRect(0,h*.42,w,h*.16);c.fillStyle='#3d4853';c.fillRect(w*.18,0,w*.085,h);c.fillRect(0,h*.32,w,h*.07);
for(let i=0;i<24;i++){let x=(i*29%206)+5,z=(i*41%166)+3;c.fillStyle=i%2?'#6bb460':'#438d50';c.beginPath();c.arc(x,z,2.2+i%4,0,Math.PI*2);c.fill()}
let Hx=px(0),Hy=pz(66);c.fillStyle='#fdb82b';c.beginPath();c.arc(Hx,Hy,8,0,Math.PI*2);c.fill();c.textAlign='center';c.font='900 10px sans-serif';c.fillStyle='#153e54';c.fillText('H',Hx,Hy+4);
let X=clamp(px(pos.x),4,w-4),Y=clamp(pz(pos.z),4,h-4);c.strokeStyle='#f9ffff';c.lineWidth=3;c.beginPath();c.moveTo(Hx,Hy);c.lineTo(X,Y);c.stroke();c.fillStyle='#1287ec';c.beginPath();c.arc(X,Y,6,0,Math.PI*2);c.fill();c.strokeStyle='#fff';c.lineWidth=2;c.stroke();c.strokeStyle='#e73f2b';c.beginPath();c.moveTo(X,Y);c.lineTo(X+10*Math.sin(yaw),Y-10*Math.cos(yaw));c.stroke();
$('infoHeight').textContent='H '+pos.y.toFixed(1)+' m';$('infoDistance').textContent='D '+Math.round(Math.hypot(pos.x,pos.z-66))+' m';$('infoSpeed').textContent=(keys.size&&air?'8.0':'0.0')+' m/s';$('infoDirection').textContent='↗ '+Math.round((yaw*180/Math.PI%360+360)%360)+'°';}
let mapLast=0;
if(['localhost','127.0.0.1'].includes(location.hostname))window.__flightTest={get:()=>({pos:{...pos},rth,rthPhase,air,done,stage,progress,score,flightSeconds}),setPosition:(x,y,z)=>{pos={x,y,z};air=true;done=false;flightStarted=true;},step:dt=>tick(dt),rth:()=>{$('rth').click()},select:id=>{$('missionSelect').value=String(id);loadMission()}};
MISSIONS.forEach((m,i)=>$('missionSelect').add(new Option((i+1)+'. '+m[0],String(i))));$('missionSelect').add(new Option('BONUS: vrije vliegwereld','free'));$('missionSelect').options[$('missionSelect').options.length-1].disabled=Object.keys(records()).length<10;loadMission();requestAnimationFrame(render);
})();
