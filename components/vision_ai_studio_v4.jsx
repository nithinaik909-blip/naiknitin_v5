import { useState, useRef, useEffect } from "react";

/* ══════════════════════════════════════════════════
   IMAGE UTILS
══════════════════════════════════════════════════ */
function enhanceImageEl(imgEl, contrast = 1.3) {
  const tmp = document.createElement("canvas");
  tmp.width = imgEl.naturalWidth; tmp.height = imgEl.naturalHeight;
  const ctx = tmp.getContext("2d");
  ctx.drawImage(imgEl, 0, 0);
  const id = ctx.getImageData(0, 0, tmp.width, tmp.height);
  const d = id.data, w = tmp.width, h = tmp.height, out = new Uint8ClampedArray(d);
  const k = [0,-1,0,-1,5,-1,0,-1,0];
  for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++) {
    const i=(y*w+x)*4;
    for (let c=0;c<3;c++) {
      let v=0;
      for (let ky=-1;ky<=1;ky++) for (let kx=-1;kx<=1;kx++)
        v+=d[((y+ky)*w+(x+kx))*4+c]*k[(ky+1)*3+(kx+1)];
      out[i+c]=Math.min(255,Math.max(0,v));
    }
    out[i+3]=d[i+3];
  }
  id.data.set(out); ctx.putImageData(id,0,0);
  const c2=document.createElement("canvas"); c2.width=tmp.width; c2.height=tmp.height;
  const ctx2=c2.getContext("2d");
  ctx2.filter=`contrast(${contrast*100}%) brightness(108%)`;
  ctx2.drawImage(tmp,0,0);
  return c2.toDataURL("image/jpeg",0.93).split(",")[1];
}

function loadImg(src) {
  return new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src=src; });
}

/* ══════════════════════════════════════════════════
   CANVAS — PCB COMPONENTS WITH L1 L2 L3 LOCATION TAGS
══════════════════════════════════════════════════ */
function drawPCBComponents(canvas, imgEl, comps, selectedLoc, isMissingMode) {
  if (!canvas||!imgEl) return;
  const ctx=canvas.getContext("2d");
  canvas.width=imgEl.naturalWidth; canvas.height=imgEl.naturalHeight;
  ctx.drawImage(imgEl,0,0);
  if (!comps||comps.length===0) return;

  comps.forEach(comp=>{
    if (!comp.bbox) return;
    const x=(comp.bbox.x/100)*canvas.width;
    const y=(comp.bbox.y/100)*canvas.height;
    const bw=(comp.bbox.w/100)*canvas.width;
    const bh=(comp.bbox.h/100)*canvas.height;
    const isSel=selectedLoc===comp.loc;
    const isMiss=comp.status==="MISSING";
    const dimmed=selectedLoc&&!isSel;

    let clr = isMiss?"#ef4444":isSel?"#f59e0b":isMissingMode?"#3b82f6":"#10b981";
    let fill= isMiss?"rgba(239,68,68,0.18)":isSel?"rgba(245,158,11,0.15)":isMissingMode?"rgba(59,130,246,0.1)":"rgba(16,185,129,0.1)";

    ctx.save();
    ctx.globalAlpha=dimmed?0.38:1;

    // Box
    ctx.fillStyle=fill; ctx.fillRect(x,y,bw,bh);
    if(isSel){ctx.shadowColor=clr;ctx.shadowBlur=18;}
    ctx.strokeStyle=clr; ctx.lineWidth=isSel?2.8:isMiss?2.2:1.6;
    ctx.strokeRect(x,y,bw,bh);
    ctx.shadowBlur=0;

    // Corner brackets
    const cs=Math.min(bw,bh,22);
    ctx.lineWidth=isSel?3:2;
    [[x,y+cs,x,y,x+cs,y],[x+bw-cs,y,x+bw,y,x+bw,y+cs],
     [x,y+bh-cs,x,y+bh,x+cs,y+bh],[x+bw-cs,y+bh,x+bw,y+bh,x+bw,y+bh-cs]]
    .forEach(([x1,y1,x2,y2,x3,y3])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.stroke();});

    // ── BIG LOCATION TAG (L1, L2 …) ──
    const locFs=Math.max(12,Math.min(18,canvas.width/42));
    ctx.font=`bold ${locFs}px 'JetBrains Mono','Courier New',monospace`;
    const locW=ctx.measureText(comp.loc).width;
    const tagW=locW+14, tagH=locFs+10;
    const tagX=x;
    const tagY=y-tagH-3<0?y+bh+3:y-tagH-3;
    ctx.fillStyle=clr;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(tagX,tagY,tagW,tagH,4);
    else ctx.rect(tagX,tagY,tagW,tagH);
    ctx.fill();
    ctx.globalAlpha=1; ctx.fillStyle="#fff";
    ctx.fillText(comp.loc, tagX+7, tagY+locFs+2);

    // ── COMPONENT NAME (smaller label) ──
    const displayName=comp.name||comp.type||"";
    if(displayName) {
      const nfs=Math.max(8,Math.min(11,canvas.width/72));
      ctx.font=`500 ${nfs}px 'DM Sans','Segoe UI',sans-serif`;
      const nm=displayName.length>24?displayName.slice(0,22)+"…":displayName;
      const nW=ctx.measureText(nm).width;
      const nbX=Math.min(tagX, canvas.width-nW-14);
      const nbY=tagY+tagH+2;
      ctx.fillStyle=clr+"cc";
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(nbX,nbY,nW+12,nfs+8,3);
      else ctx.rect(nbX,nbY,nW+12,nfs+8);
      ctx.fill();
      ctx.fillStyle="#fff";
      ctx.fillText(nm, nbX+6, nbY+nfs+2);
    }

    // Confidence dot
    if(comp.confidence!=null){
      const pct=Math.round(comp.confidence*100);
      const dc=pct>70?"#10b981":pct>40?"#f59e0b":"#ef4444";
      ctx.font=`bold 8px monospace`;
      ctx.fillStyle=dc+"dd";
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x+bw-30,y+3,28,13,3);
      else ctx.rect(x+bw-30,y+3,28,13);
      ctx.fill(); ctx.fillStyle="#fff";
      ctx.fillText(`${pct}%`,x+bw-28,y+12);
    }
    ctx.restore();
  });
}

function drawGenericBoxes(canvas, imgEl, items, selectedIdx, color) {
  if(!canvas||!imgEl) return;
  const ctx=canvas.getContext("2d");
  canvas.width=imgEl.naturalWidth; canvas.height=imgEl.naturalHeight;
  ctx.drawImage(imgEl,0,0);
  if(!items?.length) return;
  items.forEach((obj,i)=>{
    if(!obj.bbox) return;
    const x=(obj.bbox.x/100)*canvas.width, y=(obj.bbox.y/100)*canvas.height;
    const bw=(obj.bbox.w/100)*canvas.width, bh=(obj.bbox.h/100)*canvas.height;
    const isSel=selectedIdx===i;
    ctx.save(); ctx.globalAlpha=selectedIdx===null||isSel?1:0.4;
    ctx.fillStyle=color+"18"; ctx.fillRect(x,y,bw,bh);
    if(isSel){ctx.shadowColor=color;ctx.shadowBlur=16;}
    ctx.strokeStyle=color; ctx.lineWidth=isSel?2.5:1.8; ctx.strokeRect(x,y,bw,bh);
    ctx.shadowBlur=0;
    const cs=Math.min(bw,bh,20); ctx.lineWidth=isSel?3:2;
    [[x,y+cs,x,y,x+cs,y],[x+bw-cs,y,x+bw,y,x+bw,y+cs],
     [x,y+bh-cs,x,y+bh,x+cs,y+bh],[x+bw-cs,y+bh,x+bw,y+bh,x+bw,y+bh-cs]]
    .forEach(([x1,y1,x2,y2,x3,y3])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.stroke();});
    const fs=Math.max(10,Math.min(13,canvas.width/60));
    ctx.font=`600 ${fs}px 'DM Sans',sans-serif`;
    const lbl=obj.item||`#${i+1}`;
    const tw=ctx.measureText(lbl).width;
    const lh=fs+9, lx=Math.min(x,canvas.width-tw-16), ly=y-lh-3<0?y+bh+3:y-lh-3;
    ctx.fillStyle=color+"ee";
    ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(lx,ly,tw+14,lh,4); else ctx.rect(lx,ly,tw+14,lh);
    ctx.fill(); ctx.globalAlpha=1; ctx.fillStyle="#fff"; ctx.fillText(lbl,lx+7,ly+fs+1);
    if(obj.confidence!=null){
      const pct=Math.round(obj.confidence*100);
      const bc=pct>70?"#10b981":pct>40?"#f59e0b":"#ef4444";
      ctx.font="bold 8px monospace"; ctx.fillStyle=bc+"dd";
      ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x+bw-30,y+2,28,13,3); else ctx.rect(x+bw-30,y+2,28,13);
      ctx.fill(); ctx.fillStyle="#fff"; ctx.fillText(`${pct}%`,x+bw-28,y+11);
    }
    ctx.restore();
  });
}

/* ══════════════════════════════════════════════════
   API
══════════════════════════════════════════════════ */
async function callClaude(content, maxTokens=3000) {
  let res;
  try { res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:maxTokens,messages:[{role:"user",content}]})}); }
  catch(e){ throw new Error("Cannot reach /api/claude proxy. Deploy api/claude.js to Vercel and set ANTHROPIC_API_KEY in env vars."); }
  const raw=await res.text();
  let data;
  try{ data=JSON.parse(raw); }
  catch{ throw new Error(`API proxy returned HTML (not JSON) — this means api/claude.js is not deployed or ANTHROPIC_API_KEY is missing. Raw: ${raw.slice(0,100)}`); }
  if(data.error) throw new Error(data.error.message||JSON.stringify(data.error));
  return (data.content?.map(b=>b.text||"").join("")||"").replace(/```json|```/g,"").trim();
}
function parseJSON(t){try{return JSON.parse(t);}catch{return [];}}

/* ══════════════════════════════════════════════════
   PROMPTS
══════════════════════════════════════════════════ */
const PCB_DETECT_PROMPT=`You are an expert PCB quality-control engineer and electronics component analyst.

Carefully examine this PCB image and detect EVERY individual electronic component — no matter how small.

Find ALL instances of:
• ICs / chips (DIP, SOIC, QFP, BGA, SOP, TSSOP packages)
• Electrolytic capacitors (tall cylindrical, stripe marking)
• Ceramic / SMD capacitors (tiny rectangular, tan/yellow/brown)
• Through-hole resistors (cylindrical, color bands)
• SMD resistors (tiny rectangular chips, 0402/0603/0805 packages)
• Inductors / coils / ferrite beads
• LEDs and diodes (glass/plastic body, sometimes stripe)
• Transistors / MOSFETs (3-legged, TO-92/SOT-23)
• Crystals / oscillators (silver metallic cans)
• Voltage regulators (TO-220, TO-92, or SMD)
• Connectors / headers / pin strips / JST / USB / barrel jack / RJ45
• Relays / transformers
• Fuses / fuse holders / polyfuses
• Test points / jumpers / solder bridges
• Any other visible electronic component

For EACH component return:
{
  "type": "component category e.g. 'Electrolytic Capacitor', 'SMD Resistor', 'IC Chip', 'Crystal Oscillator'",
  "name": "best identified name if readable e.g. 'LM7805', '10µF 25V', '16MHz Crystal', 'ATmega328P'. Empty string '' if unreadable.",
  "location": "precise position e.g. 'top-left corner near DC jack', 'center row between U1 and C3', 'bottom-right edge'",
  "confidence": 0.0 to 1.0,
  "bbox": { "x": percent_from_left, "y": percent_from_top, "w": width_percent, "h": height_percent }
}
Bounding boxes MUST be tight around each individual component.
Be thorough — it is better to over-detect than to miss components.
Return ONLY a raw JSON array. No markdown. No explanation.`;

function PCB_COMPARE_PROMPT(comps) {
  return `You are a PCB quality-control inspector performing board comparison.

The following components are EXPECTED on the board. Each has a location code and description:
${comps.map(c=>`  ${c.loc}: ${c.name||c.type||"Unknown"}${c.type&&c.name?" ("+c.type+")":""}  — expected at: ${c.location||"unknown"}`).join("\n")}

Examine the PCB image carefully, zone by zone, top-to-bottom, left-to-right.

For EACH expected component that is ABSENT (empty solder pads / bare footprint / no component body):
{
  "loc": "the location code from above list e.g. L3",
  "item": "component name from list",
  "location": "where the empty pad/footprint is on the board — be specific",
  "description": "what you see e.g. 'empty through-hole pads', 'bare SMD footprint with solder but no component'",
  "confidence": 0.0 to 1.0,
  "status": "MISSING",
  "bbox": { "x": 0-100, "y": 0-100, "w": 0-100, "h": 0-100 }
}
bbox marks the EMPTY LOCATION where the component should be.
If ALL components are present, return: []
Return ONLY raw JSON array. No markdown.`;
}

function OBJECT_PROMPT(query,hasRef){
  return `You are a precise forensic visual analyst.
${hasRef?"Image 1 = REFERENCE object/person. Image 2 = TARGET scene. Find ALL instances including partial views, different angles, varied scales.":query?.trim()?`Find every instance of: "${query}". Include partial, small, occluded.`:"Identify EVERY distinct object, person, text, and item. Be exhaustive."}
Return JSON: {"item":"specific name","location":"precise position","description":"color/size/state","confidence":0.0-1.0,"bbox":{"x":0-100,"y":0-100,"w":0-100,"h":0-100}}
Return ONLY raw JSON array.`;
}
function FACE_PROMPT(hasRef){
  return hasRef
    ?`Facial recognition: Image 1=REFERENCE, Image 2=TARGET.
Match using eye spacing/shape, nose bridge, lip shape, jaw, cheekbones, face shape. Account for angles, lighting, accessories, partial views.
{"item":"FACE MATCH"(>0.7)/"POSSIBLE MATCH"(0.4-0.7)/"PARTIAL VIEW"(<0.4),"location":"where","description":"features visible","matchReason":"specific matching features","confidence":0.0-1.0,"bbox":{"x","y","w","h"}}
Only confidence > 0.3. Return ONLY raw JSON array.`
    :`Detect ALL faces: frontal, profile, partial, background, small, cut-off edges.
{"item":"Face #N","location":"position","description":"skin tone, hair, eyes, age range, accessories","confidence":0.0-1.0,"bbox":{"x","y","w","h"}}
Return ONLY raw JSON array.`;
}

/* ══════════════════════════════════════════════════
   SMALL UI COMPONENTS
══════════════════════════════════════════════════ */
function ConfBadge({conf}){
  if(conf==null) return null;
  const pct=Math.round(conf*100);
  const c=pct>70?"#10b981":pct>40?"#f59e0b":"#ef4444";
  return <span style={{background:c+"18",color:c,border:`1px solid ${c}40`,padding:"1px 6px",borderRadius:4,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{pct}%</span>;
}

function Spin({color="#3b82f6",size=20}){
  return <div style={{width:size,height:size,border:`2.5px solid ${color}22`,borderTop:`2.5px solid ${color}`,borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>;
}

function DropZone({src,onFile,onCam,onClear,label,sublabel,height=150}){
  const ref=useRef();
  return (
    <div>
      <div onClick={()=>ref.current.click()} onDragOver={e=>e.preventDefault()}
        onDrop={e=>{e.preventDefault();onFile(e.dataTransfer.files[0]);}}
        style={{height,border:`2px dashed ${src?"#bbf7d0":"#d1d5db"}`,borderRadius:10,cursor:"pointer",overflow:"hidden",position:"relative",background:src?"#f0fdf4":"#fafafa",transition:"all 0.15s"}}>
        {src?<img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
          :<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#9ca3af",gap:6,padding:12,textAlign:"center"}}>
            <div style={{fontSize:28}}>📁</div>
            <div style={{fontSize:12,fontWeight:600}}>{label||"Click or drag to upload"}</div>
            {sublabel&&<div style={{fontSize:11,color:"#d1d5db"}}>{sublabel}</div>}
          </div>}
      </div>
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={e=>onFile(e.target.files[0])}/>
      <div style={{display:"flex",gap:6,marginTop:8}}>
        <button onClick={onCam} style={{flex:1,padding:"8px 0",background:"#f8fafc",color:"#475569",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer"}}>📷 Camera</button>
        {src&&<button onClick={onClear} style={{padding:"8px 10px",background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca",borderRadius:8,fontSize:12,cursor:"pointer"}}>✕</button>}
      </div>
    </div>
  );
}

function typeColor(type){
  const t=(type||"").toLowerCase();
  if(t.includes("electrolytic")||t.includes("capacitor")) return "#3b82f6";
  if(t.includes("resistor")) return "#8b5cf6";
  if(t.includes("ic")||t.includes("chip")||t.includes("microcontroller")) return "#f59e0b";
  if(t.includes("connector")||t.includes("header")||t.includes("jack")||t.includes("usb")) return "#ec4899";
  if(t.includes("crystal")||t.includes("oscillator")) return "#06b6d4";
  if(t.includes("transistor")||t.includes("mosfet")) return "#84cc16";
  if(t.includes("inductor")||t.includes("coil")||t.includes("ferrite")) return "#a855f7";
  if(t.includes("led")||t.includes("diode")) return "#f97316";
  if(t.includes("regulator")) return "#14b8a6";
  if(t.includes("relay")||t.includes("transformer")) return "#d946ef";
  if(t.includes("fuse")||t.includes("test")) return "#78716c";
  return "#64748b";
}

/* ══════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════ */
export default function App() {
  const [mode,setMode]=useState("pcb");

  // Shared
  const [targetImg,setTargetImg]=useState(null);
  const [targetData,setTargetData]=useState(null);
  const [refImg,setRefImg]=useState(null);
  const [refData,setRefData]=useState(null);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState(null);
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [error,setError]=useState(null);
  const [selectedIdx,setSelectedIdx]=useState(null);

  // Camera
  const [camOpen,setCamOpen]=useState(false);
  const [camFor,setCamFor]=useState("target");
  const [facing,setFacing]=useState("environment");
  const streamRef=useRef(); const videoRef=useRef(); const capRef=useRef();

  // PCB
  const [pcbStep,setPcbStep]=useState(1);
  const [pcbRefImg,setPcbRefImg]=useState(null);
  const [pcbRefData,setPcbRefData]=useState(null);
  const [components,setComponents]=useState([]);
  const [editIdx,setEditIdx]=useState(null);
  const [editVal,setEditVal]=useState({name:"",location:""});
  const [selectedLoc,setSelectedLoc]=useState(null);
  const [missingList,setMissingList]=useState(null);

  const canvasRef=useRef();
  const imgElRef=useRef(null);
  const refCanvasRef=useRef();

  const MODES={
    object:{label:"Object Finder",icon:"🔍",color:"#3b82f6"},
    face:  {label:"Face Match",   icon:"👤",color:"#8b5cf6"},
    pcb:   {label:"PCB Inspector",icon:"🔌",color:"#10b981"},
  };
  const mc=MODES[mode];

  const reset=()=>{setResults(null);setError(null);setSelectedIdx(null);setSelectedLoc(null);setMissingList(null);};

  /* File load */
  const loadB64=(file,cb)=>{
    if(!file?.type.startsWith("image/")) return;
    const r=new FileReader(); r.onload=e=>cb(e.target.result,e.target.result.split(",")[1]); r.readAsDataURL(file);
  };
  const setTarget=(src,b64)=>{
    setTargetImg(src);setTargetData(b64);reset();
    loadImg(src).then(img=>{
      imgElRef.current=img;
      const c=canvasRef.current;
      if(c){c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0);}
    });
  };

  /* Camera */
  const openCam=async(forWhat,fm)=>{
    const f=fm||facing; setCamFor(forWhat);
    try{
      if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
      const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:f,width:{ideal:1280}}});
      streamRef.current=st; videoRef.current.srcObject=st; videoRef.current.play(); setCamOpen(true);
    }catch{setError("Camera access denied.");}
  };
  const flipCam=async()=>{const nf=facing==="environment"?"user":"environment";setFacing(nf);await openCam(camFor,nf);};
  const closeCam=()=>{streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setCamOpen(false);};
  const captureCam=()=>{
    const c=capRef.current,v=videoRef.current;
    c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0);
    const url=c.toDataURL("image/jpeg",0.93),b64=url.split(",")[1];
    closeCam();
    if(camFor==="ref"){setRefImg(url);setRefData(b64);}
    else if(camFor==="pcbRef"){setPcbRefImg(url);setPcbRefData(b64);setComponents([]);reset();}
    else setTarget(url,b64);
  };

  /* Redraw on selection */
  useEffect(()=>{
    if(mode!=="pcb"&&results&&canvasRef.current&&imgElRef.current)
      drawGenericBoxes(canvasRef.current,imgElRef.current,results,selectedIdx,mc.color);
  },[selectedIdx,results]);

  useEffect(()=>{
    if(mode==="pcb"){
      if(pcbStep===1&&refCanvasRef.current&&pcbRefImg)
        loadImg(pcbRefImg).then(img=>drawPCBComponents(refCanvasRef.current,img,components,selectedLoc,false));
      if(pcbStep===2&&canvasRef.current&&imgElRef.current)
        drawPCBComponents(canvasRef.current,imgElRef.current,missingList||[],selectedLoc,true);
    }
  },[selectedLoc,components,missingList,pcbStep]);

  /* Object/Face scan */
  const scanObjectFace=async()=>{
    if(!targetData) return;
    setLoading(true);setError(null);setResults(null);setSelectedIdx(null);
    setLoadMsg(mode==="face"?"Scanning faces…":"Detecting objects…");
    try{
      const b64=enhanceImageEl(imgElRef.current);
      let content;
      if(mode==="face"){
        const p=FACE_PROMPT(!!refData);
        content=refData?[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:refData}},{type:"text",text:"[REFERENCE FACE]"},{type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}},{type:"text",text:"[TARGET]\n"+p}]:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}},{type:"text",text:p}];
      } else {
        const p=OBJECT_PROMPT(query,!!refData);
        content=refData?[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:refData}},{type:"text",text:"[REFERENCE]"},{type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}},{type:"text",text:"[TARGET]\n"+p}]:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}},{type:"text",text:p}];
      }
      const items=parseJSON(await callClaude(content,2600));
      setResults(items);
      const img=await loadImg(targetImg);
      imgElRef.current=img;
      drawGenericBoxes(canvasRef.current,img,items,null,mc.color);
    }catch(e){setError(e.message);}
    setLoading(false);setLoadMsg("");
  };

  /* PCB Step 1: scan reference */
  const pcbScanRef=async()=>{
    if(!pcbRefData) return;
    setLoading(true);setError(null);setComponents([]);setSelectedLoc(null);
    setLoadMsg("Identifying all components on reference board…");
    try{
      const refEl=await loadImg(pcbRefImg);
      const b64=enhanceImageEl(refEl,1.4);
      const raw=parseJSON(await callClaude([{type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}},{type:"text",text:PCB_DETECT_PROMPT}],3500));
      // Assign L1, L2, L3 … to every component
      const mapped=raw.map((c,i)=>({
        loc:`L${i+1}`,
        type:c.type||"Unknown",
        name:c.name||"",
        location:c.location||"",
        confidence:c.confidence,
        bbox:c.bbox,
        confirmed:true,
      }));
      setComponents(mapped);
      drawPCBComponents(refCanvasRef.current,refEl,mapped,null,false);
    }catch(e){setError(e.message);}
    setLoading(false);setLoadMsg("");
  };

  /* PCB Step 2: compare */
  const pcbCompare=async()=>{
    if(!targetData||components.length===0) return;
    setLoading(true);setError(null);setMissingList(null);setSelectedLoc(null);
    setLoadMsg("Comparing boards — scanning for missing components…");
    try{
      const b64=enhanceImageEl(imgElRef.current,1.4);
      const confirmed=components.filter(c=>c.confirmed);
      const raw=parseJSON(await callClaude([{type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}},{type:"text",text:PCB_COMPARE_PROMPT(confirmed)}],3000));
      const missing=raw.map(r=>({...r,status:"MISSING"}));
      setMissingList(missing);
      const img=await loadImg(targetImg); imgElRef.current=img;
      drawPCBComponents(canvasRef.current,img,missing,null,true);
    }catch(e){setError(e.message);}
    setLoading(false);setLoadMsg("");
  };

  /* Component editing */
  const startEdit=(i)=>{setEditIdx(i);setEditVal({name:components[i].name,location:components[i].location});};
  const saveEdit=()=>{
    if(editIdx===null) return;
    setComponents(p=>p.map((c,j)=>j===editIdx?{...c,...editVal}:c));
    setEditIdx(null);
  };
  const addManual=()=>{
    const nc={loc:`L${components.length+1}`,type:"Manual",name:"",location:"",confidence:1,bbox:null,confirmed:true};
    setComponents(p=>[...p,nc]);
    setEditIdx(components.length);
    setEditVal({name:"",location:""});
  };
  const deleteComp=(i)=>setComponents(p=>p.filter((_,j)=>j!==i));
  const toggleComp=(i)=>setComponents(p=>p.map((c,j)=>j===i?{...c,confirmed:!c.confirmed}:c));
  const renameLocation=(i)=>{
    const v=prompt(`Rename location tag (currently ${components[i].loc}):`,components[i].loc);
    if(v?.trim()) setComponents(p=>p.map((c,j)=>j===i?{...c,loc:v.trim().toUpperCase()}:c));
  };

  const hitTest=(e,canvasDom,items)=>{
    if(!items?.length||!canvasDom) return null;
    const rect=canvasDom.getBoundingClientRect();
    const sx=canvasDom.width/rect.width,sy=canvasDom.height/rect.height;
    const mx=(e.clientX-rect.left)*sx,my=(e.clientY-rect.top)*sy;
    return items.find(r=>r.bbox&&mx>=(r.bbox.x/100)*canvasDom.width&&mx<=(r.bbox.x+r.bbox.w)/100*canvasDom.width&&my>=(r.bbox.y/100)*canvasDom.height&&my<=(r.bbox.y+r.bbox.h)/100*canvasDom.height);
  };

  const switchMode=(m)=>{setMode(m);reset();if(m==="pcb")setPcbStep(1);};

  /* ── RENDER ── */
  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      html,body{min-height:100%;font-family:'DM Sans',system-ui,sans-serif;background:#f0f4f8;color:#1e293b;}
      button{font-family:inherit;cursor:pointer;transition:all 0.13s;}
      input{font-family:inherit;color:#1e293b;}
      ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px;}
      @keyframes spin{to{transform:rotate(360deg);}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
      @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
      .card{background:#fff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,0.06);}
      .btnP{padding:11px 18px;border:none;border-radius:9px;font-size:13px;font-weight:600;color:#fff;display:inline-flex;align-items:center;gap:7px;justify-content:center;}
      .btnP:not(:disabled):hover{filter:brightness(1.08);}
      .btnP:disabled{background:#e2e8f0!important;color:#94a3b8;cursor:not-allowed;}
      .btnG{padding:8px 13px;background:#f8fafc;color:#475569;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:500;}
      .btnG:hover{background:#f1f5f9;border-color:#cbd5e1;}
      .row{display:grid;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #f8fafc;transition:background 0.1s;animation:fadeUp 0.18s ease both;}
      .row:hover{background:#fafafa;}
      .rrow{padding:10px 14px;border-bottom:1px solid #f8fafc;cursor:pointer;transition:background 0.12s;animation:fadeUp 0.18s ease both;}
      .rrow:hover{background:#f8fafc;}
      .tab{padding:7px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s;}
      .tab.on{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.1);}
      .tab:not(.on){background:transparent;color:#64748b;}
      .tab:not(.on):hover{color:#1e293b;background:rgba(255,255,255,0.5);}
      .locTag{display:inline-flex;align-items:center;padding:2px 8px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;letter-spacing:0.5px;}
    `}</style>

    {/* Camera overlay */}
    {camOpen&&(
      <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(2,6,15,0.96)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18}}>
        <div style={{color:"#64748b",fontSize:11,letterSpacing:1.2,textTransform:"uppercase"}}>
          {camFor==="pcbRef"?"Reference PCB":camFor==="ref"?"Reference":"Target"} — {facing==="user"?"Front":"Rear"} Camera
        </div>
        <div style={{position:"relative",borderRadius:16,overflow:"hidden",border:`2.5px solid ${mc.color}`,boxShadow:`0 0 50px ${mc.color}44`}}>
          <video ref={videoRef} style={{display:"block",maxWidth:"min(92vw,720px)",maxHeight:"62vh"}} playsInline muted/>
          <div style={{position:"absolute",inset:0,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{position:"absolute",width:2,height:"25%",background:mc.color+"60"}}/>
            <div style={{position:"absolute",width:"25%",height:2,background:mc.color+"60"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={flipCam} className="btnG" style={{color:"#e2e8f0",background:"#1e293b",border:"1px solid #334155",padding:"10px 20px"}}>
            🔄 {facing==="environment"?"→ Front":"→ Rear"}
          </button>
          <button onClick={captureCam} style={{padding:"12px 36px",background:mc.color,color:"#fff",border:"none",borderRadius:11,fontSize:15,fontWeight:700,boxShadow:`0 4px 20px ${mc.color}55`,cursor:"pointer"}}>
            📸 Capture
          </button>
          <button onClick={closeCam} className="btnG" style={{color:"#94a3b8",background:"transparent",border:"1px solid #334155",padding:"10px 16px"}}>
            ✕ Cancel
          </button>
        </div>
      </div>
    )}
    <canvas ref={capRef} style={{display:"none"}}/>

    {/* Header */}
    <div style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 24px",display:"flex",alignItems:"center",height:58,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,background:`linear-gradient(135deg,${mc.color},${mc.color}99)`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:`0 2px 8px ${mc.color}40`,flexShrink:0}}>
          {mc.icon}
        </div>
        <div>
          <div style={{fontWeight:700,fontSize:16,color:"#0f172a",letterSpacing:-0.3}}>Vision AI Studio</div>
        </div>
        <span style={{background:"#f1f5f9",color:"#94a3b8",padding:"2px 7px",borderRadius:5,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>v4.1</span>
      </div>
      <div style={{flex:1}}/>
      <div style={{display:"flex",gap:2,background:"#f1f5f9",padding:3,borderRadius:11,border:"1px solid #e2e8f0"}}>
        {Object.entries(MODES).map(([k,v])=>(
          <button key={k} onClick={()=>switchMode(k)} className={`tab${mode===k?" on":""}`} style={{color:mode===k?v.color:undefined}}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>
    </div>

    {/* Body */}
    <div style={{padding:"18px 20px 24px",maxWidth:1520,margin:"0 auto"}}>

      {/* ══ OBJECT / FACE ══ */}
      {(mode==="object"||mode==="face")&&(
        <div style={{display:"grid",gridTemplateColumns:"258px 1fr 262px",gap:14,alignItems:"start"}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="card" style={{overflow:"hidden"}}>
              <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:600,fontSize:13}}>01 / Target</div><div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>Scene to analyse</div></div>
                <div style={{width:8,height:8,borderRadius:"50%",background:targetImg?"#10b981":"#e2e8f0"}}/>
              </div>
              <div style={{padding:10}}><DropZone src={targetImg} height={140} onFile={f=>loadB64(f,setTarget)} onCam={()=>openCam("target")} onClear={()=>{setTargetImg(null);setTargetData(null);reset();}}/></div>
            </div>
            <div className="card" style={{overflow:"hidden"}}>
              <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:600,fontSize:13}}>02 / Reference <span style={{fontWeight:400,color:"#94a3b8",fontSize:11}}>(optional)</span></div><div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{mode==="face"?"Face to find":"Object to locate"}</div></div>
                <div style={{width:8,height:8,borderRadius:"50%",background:refImg?"#10b981":"#e2e8f0"}}/>
              </div>
              <div style={{padding:10}}><DropZone src={refImg} height={110} onFile={f=>loadB64(f,(s,b)=>{setRefImg(s);setRefData(b);})} onCam={()=>openCam("ref")} onClear={()=>{setRefImg(null);setRefData(null);}}/></div>
            </div>
            {mode==="object"&&(
              <div className="card" style={{padding:12}}>
                <div style={{fontSize:11,fontWeight:600,color:"#64748b",marginBottom:6}}>SEARCH QUERY</div>
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. red mug, person in blue…"
                  style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,outline:"none"}}
                  onFocus={e=>e.target.style.borderColor=mc.color} onBlur={e=>e.target.style.borderColor="#e2e8f0"}/>
              </div>
            )}
            <button className="btnP" onClick={scanObjectFace} disabled={!targetImg||loading} style={{background:mc.color,width:"100%",padding:"12px 0",fontSize:14}}>
              {loading?<><Spin color="#fff"/>{loadMsg}</>:<>{mc.icon} Analyse Image</>}
            </button>
          </div>

          <div className="card" style={{overflow:"hidden"}}>
            <div style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:11,fontWeight:600,color:"#94a3b8",letterSpacing:0.5}}>DETECTION CANVAS</div>
              {results&&<div style={{fontSize:12,color:mc.color,fontWeight:600}}>{results.length} detected</div>}
            </div>
            <div style={{padding:14,display:"flex",alignItems:"center",justifyContent:"center",minHeight:430,background:"#f8fafc"}}>
              {targetImg?<canvas ref={canvasRef} onClick={e=>{if(!results)return;const hit=results.findIndex((_,i)=>hitTest(e,canvasRef.current,[results[i]]));setSelectedIdx(hit>=0?(selectedIdx===hit?null:hit):null);}} style={{maxWidth:"100%",maxHeight:"calc(100vh - 185px)",display:"block",cursor:results?"crosshair":"default",borderRadius:8,boxShadow:"0 2px 10px rgba(0,0,0,0.08)"}}/>
              :<div style={{textAlign:"center",color:"#d1d5db"}}><div style={{fontSize:50,marginBottom:10}}>{mc.icon}</div><div style={{fontSize:13}}>Load a target image to begin</div></div>}
            </div>
          </div>

          <div className="card" style={{overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"calc(100vh - 90px)"}}>
            <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div style={{fontWeight:600,fontSize:13}}>Results</div>
              {results&&<span style={{background:mc.color+"18",color:mc.color,padding:"2px 8px",borderRadius:5,fontSize:11,fontWeight:600}}>{results.length}</span>}
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              {error&&<div style={{margin:10,padding:10,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,color:"#dc2626",fontSize:12,lineHeight:1.5}}>⚠ {error}</div>}
              {loading&&<div style={{padding:24,textAlign:"center",color:mc.color}}><div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Spin color={mc.color}/></div><div style={{fontSize:12}}>{loadMsg}</div></div>}
              {results?.map((r,i)=>(
                <div key={i} className="rrow" onClick={()=>setSelectedIdx(selectedIdx===i?null:i)}
                  style={{borderLeft:`3px solid ${selectedIdx===i?mc.color:"transparent"}`,background:selectedIdx===i?"#f8fafc":"#fff",animationDelay:`${i*0.03}s`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                    <div style={{fontWeight:600,fontSize:12,color:selectedIdx===i?mc.color:"#1e293b",flex:1,marginRight:6}}>{r.item}</div>
                    <ConfBadge conf={r.confidence}/>
                  </div>
                  <div style={{fontSize:11,color:"#64748b"}}>📍 {r.location}</div>
                  {selectedIdx===i&&r.description&&<div style={{fontSize:11,color:"#94a3b8",marginTop:5,lineHeight:1.5}}>{r.description}</div>}
                  {selectedIdx===i&&r.matchReason&&<div style={{fontSize:11,color:"#3b82f6",marginTop:4}}>🔍 {r.matchReason}</div>}
                </div>
              ))}
              {results&&results.length===0&&!loading&&<div style={{padding:28,textAlign:"center",color:"#94a3b8",fontSize:12}}>Nothing detected</div>}
            </div>
          </div>
        </div>
      )}

      {/* ══ PCB MODE ══ */}
      {mode==="pcb"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* Step bar */}
          <div className="card" style={{padding:"14px 24px",display:"flex",alignItems:"center"}}>
            {[{n:1,lbl:"Scan Reference Board",sub:"AI maps every component → assigns L1, L2, L3… tags"},
              {n:2,lbl:"Inspect Target Board",sub:"Find missing components by location code"}]
            .map((s,idx)=>(
              <div key={s.n} style={{display:"flex",alignItems:"center",flex:idx===0?"none":1}}>
                <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>{if(s.n===2&&components.length>0)setPcbStep(2);else if(s.n===1)setPcbStep(1);}}>
                  <div style={{width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,flexShrink:0,transition:"all 0.2s",
                    background:pcbStep===s.n?mc.color:pcbStep>s.n?mc.color+"22":"#f1f5f9",
                    color:pcbStep===s.n?"#fff":pcbStep>s.n?mc.color:"#94a3b8",
                    border:pcbStep>s.n?`2px solid ${mc.color}`:"2px solid transparent"}}>
                    {pcbStep>s.n?"✓":s.n}
                  </div>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:pcbStep===s.n?"#0f172a":"#94a3b8"}}>{s.lbl}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{s.sub}</div>
                  </div>
                </div>
                {idx===0&&<div style={{flex:1,height:2,background:pcbStep>1?mc.color:"#e2e8f0",borderRadius:1,margin:"0 24px",transition:"background 0.4s"}}/>}
              </div>
            ))}
          </div>

          {/* ── STEP 1 ── */}
          {pcbStep===1&&(
            <div style={{display:"grid",gridTemplateColumns:"282px 1fr",gap:14,alignItems:"start"}}>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div className="card" style={{overflow:"hidden"}}>
                  <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9"}}>
                    <div style={{fontWeight:600,fontSize:13}}>Reference PCB</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>Complete board — every component installed</div>
                  </div>
                  <div style={{padding:10}}>
                    <DropZone src={pcbRefImg} height={175}
                      onFile={f=>loadB64(f,(s,b)=>{setPcbRefImg(s);setPcbRefData(b);setComponents([]);reset();})}
                      onCam={()=>openCam("pcbRef")}
                      onClear={()=>{setPcbRefImg(null);setPcbRefData(null);setComponents([]);reset();}}
                      label="Upload Reference PCB" sublabel="All components must be visible"/>
                  </div>
                </div>
                <button className="btnP" onClick={pcbScanRef} disabled={!pcbRefData||loading} style={{background:mc.color,width:"100%",padding:"13px 0",fontSize:14}}>
                  {loading?<><Spin color="#fff" size={18}/>{loadMsg}</>:"🔍 Identify All Components"}
                </button>
                {components.length>0&&(
                  <div className="card" style={{padding:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:12,color:"#64748b"}}>Components found</span>
                      <span style={{fontWeight:700,color:mc.color,fontFamily:"'JetBrains Mono',monospace",fontSize:14}}>{components.length}</span>
                    </div>
                    <div style={{height:5,background:"#f1f5f9",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${(components.filter(c=>c.confirmed).length/components.length)*100}%`,background:mc.color,borderRadius:3,transition:"width 0.3s"}}/>
                    </div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:6}}>{components.filter(c=>c.confirmed).length} confirmed · {components.filter(c=>!c.confirmed).length} excluded</div>
                  </div>
                )}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {/* Canvas showing ref board with L1 L2 L3 markers */}
                {pcbRefImg&&(
                  <div className="card" style={{overflow:"hidden"}}>
                    <div style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:"#0f172a"}}>Component Map — Reference Board</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>Each component is assigned a location tag. Click on the canvas to highlight a component.</div>
                      </div>
                      {components.length>0&&<span style={{background:mc.color+"18",color:mc.color,padding:"3px 10px",borderRadius:6,fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{components.length} tagged</span>}
                    </div>
                    <div style={{padding:12,background:"#f8fafc",display:"flex",justifyContent:"center"}}>
                      <canvas ref={refCanvasRef}
                        onClick={e=>{const hit=hitTest(e,refCanvasRef.current,components);setSelectedLoc(hit?(selectedLoc===hit.loc?null:hit.loc):null);}}
                        style={{maxWidth:"100%",maxHeight:340,display:"block",cursor:components.length?"crosshair":"default",borderRadius:8,boxShadow:"0 2px 10px rgba(0,0,0,0.08)"}}/>
                    </div>
                  </div>
                )}

                {/* Component table */}
                <div className="card" style={{overflow:"hidden"}}>
                  <div style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>Component Registry</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>
                        <span style={{color:mc.color,fontFamily:"monospace",fontWeight:600}}>L1 L2 L3…</span> = location codes on canvas &nbsp;·&nbsp;
                        Click ✏️ to rename &nbsp;·&nbsp; Click loc tag to rename it &nbsp;·&nbsp; ☑ to include
                      </div>
                    </div>
                    <button className="btnG" onClick={addManual} style={{fontSize:12,flexShrink:0}}>+ Add Manually</button>
                  </div>

                  {error&&<div style={{margin:10,padding:10,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,color:"#dc2626",fontSize:12,lineHeight:1.6}}>
                    ⚠ {error}
                    <div style={{marginTop:6,fontSize:10,color:"#9ca3af"}}>If you see "<!DOCTYPE": deploy <code>api/claude.js</code> to Vercel and add <code>ANTHROPIC_API_KEY</code> in Vercel → Settings → Environment Variables.</div>
                  </div>}

                  {loading&&<div style={{padding:36,textAlign:"center",color:mc.color}}><div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Spin color={mc.color} size={26}/></div><div style={{fontSize:13}}>{loadMsg}</div></div>}

                  {components.length>0&&!loading&&(
                    <>
                      {/* Header row */}
                      <div style={{display:"grid",gridTemplateColumns:"18px 62px 1fr 120px 140px 80px",gap:8,padding:"6px 12px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",alignItems:"center"}}>
                        {["","LOC","COMPONENT NAME / TAP ✏️ TO EDIT","TYPE","BOARD LOCATION","CONF"].map((h,i)=>(
                          <div key={i} style={{fontSize:9,fontWeight:700,color:"#94a3b8",letterSpacing:0.6}}>{h}</div>
                        ))}
                      </div>
                      <div style={{overflowY:"auto",maxHeight:400}}>
                        {components.map((c,i)=>(
                          <div key={i} className="row"
                            style={{gridTemplateColumns:"18px 62px 1fr 120px 140px 80px",
                              background:selectedLoc===c.loc?"#f0fdf4":editIdx===i?"#fffbeb":"#fff",
                              borderLeft:`3px solid ${selectedLoc===c.loc?mc.color:"transparent"}`,
                              animationDelay:`${i*0.018}s`}}>

                            {/* Checkbox */}
                            <input type="checkbox" checked={c.confirmed} onChange={()=>toggleComp(i)}
                              style={{accentColor:mc.color,width:15,height:15,cursor:"pointer"}}/>

                            {/* LOC tag — click to rename */}
                            <div>
                              <span className="locTag" onClick={()=>renameLocation(i)} title="Click to rename location code"
                                style={{background:mc.color+"1a",color:mc.color,cursor:"pointer",userSelect:"none",":hover":{background:mc.color+"30"}}}>
                                {c.loc}
                              </span>
                            </div>

                            {/* Name — editable */}
                            {editIdx===i
                              ?<input value={editVal.name} autoFocus placeholder="Enter component name…"
                                  onChange={e=>setEditVal(v=>({...v,name:e.target.value}))}
                                  onBlur={saveEdit}
                                  onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape")setEditIdx(null);}}
                                  style={{padding:"5px 8px",border:`1.5px solid ${mc.color}`,borderRadius:6,fontSize:12,outline:"none",width:"100%"}}/>
                              :<div onClick={()=>startEdit(i)} title="Click to edit name"
                                  style={{fontSize:12,fontWeight:c.name?500:400,color:c.name?(c.confirmed?"#1e293b":"#94a3b8"):"#d1d5db",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"text"}}>
                                  {c.name||<span style={{fontStyle:"italic",color:"#d1d5db",fontSize:11}}>tap to add name</span>}
                                </div>}

                            {/* Type */}
                            <div style={{overflow:"hidden"}}>
                              <span style={{background:typeColor(c.type)+"1a",color:typeColor(c.type),padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:500,display:"inline-block",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.type}>
                                {c.type||"Unknown"}
                              </span>
                            </div>

                            {/* Location — editable */}
                            {editIdx===i
                              ?<input value={editVal.location} placeholder="board location…"
                                  onChange={e=>setEditVal(v=>({...v,location:e.target.value}))}
                                  onBlur={saveEdit}
                                  onKeyDown={e=>{if(e.key==="Enter")saveEdit();}}
                                  style={{padding:"5px 8px",border:`1.5px solid ${mc.color}`,borderRadius:6,fontSize:11,outline:"none",width:"100%"}}/>
                              :<div style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={c.location}>{c.location||"—"}</div>}

                            {/* Conf + actions */}
                            <div style={{display:"flex",gap:4,alignItems:"center",justifyContent:"flex-end"}}>
                              <ConfBadge conf={c.confidence}/>
                              <button onClick={()=>startEdit(i)} style={{padding:"3px 6px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:5,fontSize:11}} title="Edit">✏️</button>
                              <button onClick={()=>deleteComp(i)} style={{padding:"3px 6px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:5,fontSize:11,color:"#dc2626"}} title="Delete">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{padding:"10px 16px",borderTop:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                        <div style={{fontSize:11,color:"#64748b",lineHeight:1.8}}>
                          <b>{components.filter(c=>c.confirmed).length}</b> components confirmed for board comparison.<br/>
                          Uncheck to exclude · Click <span style={{fontFamily:"monospace",color:mc.color}}>L1</span> tag to rename · ✏️ to edit name.
                        </div>
                        <button className="btnP" onClick={()=>setPcbStep(2)} disabled={components.filter(c=>c.confirmed).length===0}
                          style={{background:mc.color,padding:"10px 24px",whiteSpace:"nowrap",flexShrink:0}}>
                          Inspect Target Board →
                        </button>
                      </div>
                    </>
                  )}

                  {!loading&&components.length===0&&!error&&(
                    <div style={{padding:52,textAlign:"center",color:"#9ca3af"}}>
                      <div style={{fontSize:48,marginBottom:14}}>🔌</div>
                      <div style={{fontWeight:700,fontSize:15,marginBottom:8,color:"#64748b"}}>Upload a Reference PCB</div>
                      <div style={{fontSize:12,lineHeight:1.9,maxWidth:340,margin:"0 auto"}}>
                        The AI will detect every component and assign location codes:<br/>
                        <span style={{fontFamily:"'JetBrains Mono',monospace",color:mc.color,fontWeight:700,fontSize:16}}>L1 &nbsp; L2 &nbsp; L3 &nbsp; L4 &nbsp; L5…</span><br/>
                        You can rename, add, or remove any entry before comparing boards.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {pcbStep===2&&(
            <div style={{display:"grid",gridTemplateColumns:"268px 1fr 268px",gap:14,alignItems:"start"}}>
              {/* Left */}
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div className="card" style={{overflow:"hidden"}}>
                  <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontWeight:600,fontSize:13}}>Target PCB</div><div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>Board to inspect for missing parts</div></div>
                    <div style={{width:8,height:8,borderRadius:"50%",background:targetImg?"#10b981":"#e2e8f0"}}/>
                  </div>
                  <div style={{padding:10}}>
                    <DropZone src={targetImg} height={155} onFile={f=>loadB64(f,setTarget)} onCam={()=>openCam("target")} onClear={()=>{setTargetImg(null);setTargetData(null);reset();}}/>
                  </div>
                </div>

                <div className="card" style={{padding:12,maxHeight:200,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                  <div style={{fontSize:11,fontWeight:600,color:"#64748b",marginBottom:8,letterSpacing:0.3}}>CHECKING {components.filter(c=>c.confirmed).length} LOCATIONS</div>
                  <div style={{overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:3}}>
                    {components.filter(c=>c.confirmed).map((c,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}>
                        <span className="locTag" style={{background:mc.color+"15",color:mc.color,fontSize:10,padding:"1px 6px"}}>{c.loc}</span>
                        <span style={{color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name||c.type||"Unknown"}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btnG" onClick={()=>setPcbStep(1)} style={{marginTop:8,width:"100%",fontSize:11}}>← Edit Component List</button>
                </div>

                <button className="btnP" onClick={pcbCompare} disabled={!targetData||loading} style={{background:mc.color,width:"100%",padding:"13px 0",fontSize:14}}>
                  {loading?<><Spin color="#fff" size={18}/>{loadMsg}</>:"🔍 Find Missing Components"}
                </button>
              </div>

              {/* Canvas */}
              <div className="card" style={{overflow:"hidden"}}>
                <div style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:"#0f172a"}}>Inspection Canvas</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>Missing components marked in red with location codes</div>
                  </div>
                  {missingList&&(
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:missingList.length===0?"#10b981":"#ef4444",animation:"pulse 1.5s ease infinite"}}/>
                      <span style={{fontSize:12,fontWeight:700,color:missingList.length===0?"#10b981":"#dc2626"}}>
                        {missingList.length===0?"✓ Board OK — all present":`${missingList.length} missing`}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{padding:14,display:"flex",alignItems:"center",justifyContent:"center",minHeight:440,background:"#f8fafc"}}>
                  {targetImg
                    ?<canvas ref={canvasRef}
                        onClick={e=>{const hit=hitTest(e,canvasRef.current,missingList||[]);setSelectedLoc(hit?(selectedLoc===hit.loc?null:hit.loc):null);}}
                        style={{maxWidth:"100%",maxHeight:"calc(100vh - 185px)",display:"block",cursor:missingList?"crosshair":"default",borderRadius:8,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}/>
                    :<div style={{textAlign:"center",color:"#d1d5db"}}><div style={{fontSize:48,marginBottom:12}}>🔌</div><div style={{fontSize:13}}>Upload the target PCB board</div></div>}
                </div>
              </div>

              {/* Missing list */}
              <div className="card" style={{overflow:"hidden",display:"flex",flexDirection:"column",maxHeight:"calc(100vh - 90px)"}}>
                <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
                  <div style={{fontWeight:600,fontSize:13}}>Missing Components</div>
                  {missingList&&<div style={{fontSize:11,marginTop:2,color:missingList.length===0?"#10b981":"#dc2626"}}>
                    {missingList.length===0?"✓ All components present":`${missingList.length} missing`}
                  </div>}
                </div>
                <div style={{flex:1,overflowY:"auto"}}>
                  {error&&<div style={{margin:10,padding:10,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,color:"#dc2626",fontSize:12,lineHeight:1.5}}>⚠ {error}</div>}
                  {loading&&<div style={{padding:24,textAlign:"center",color:mc.color}}><div style={{display:"flex",justifyContent:"center",marginBottom:10}}><Spin color={mc.color}/></div><div style={{fontSize:12}}>{loadMsg}</div></div>}
                  {missingList&&missingList.length===0&&!loading&&<div style={{padding:32,textAlign:"center"}}><div style={{fontSize:42,marginBottom:8}}>✅</div><div style={{fontWeight:700,fontSize:14,color:"#10b981"}}>Board OK</div><div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>All expected components detected</div></div>}
                  {missingList?.map((r,i)=>(
                    <div key={i} className="rrow" onClick={()=>setSelectedLoc(selectedLoc===r.loc?null:r.loc)}
                      style={{borderLeft:`3px solid ${selectedLoc===r.loc?"#ef4444":"transparent"}`,background:selectedLoc===r.loc?"#fff5f5":"#fff",animationDelay:`${i*0.04}s`}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                        <span className="locTag" style={{background:"#fee2e2",color:"#dc2626",fontSize:13}}>
                          {r.loc}
                        </span>
                        <div style={{fontWeight:600,fontSize:12,color:"#dc2626",flex:1}}>⚠ {r.item||r.name}</div>
                        <ConfBadge conf={r.confidence}/>
                      </div>
                      <div style={{fontSize:11,color:"#64748b"}}>📍 {r.location}</div>
                      {selectedLoc===r.loc&&r.description&&<div style={{fontSize:11,color:"#94a3b8",marginTop:5,lineHeight:1.5}}>{r.description}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
