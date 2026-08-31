import { readFile } from "node:fs/promises";
const html = await readFile("./index.html","utf8");
const appJs = html.split("<script>").pop().split("</script>")[0];

function makeEnv(outNames, inNames, storeSeed = {}) {
  const El = class { constructor(t){this.tagName=(t||"div").toUpperCase();this.children=[];this._class="";this._text="";this.style=new Proxy({},{set:(o,k,v)=>(o[k]=v,true),get:(o,k)=>o[k]??""});this.dataset={};this.attrs={};this.listeners={};this.value="";this.hidden=false;this.disabled=false;this.scrollTop=0;this.clientHeight=700;}
    get className(){return this._class} set className(v){this._class=v||""}
    get classList(){const s=this;return{add:(...c)=>{const q=new Set(s._class.split(/\s+/).filter(Boolean));c.forEach(x=>q.add(x));s._class=[...q].join(" ")},remove:(...c)=>{const q=new Set(s._class.split(/\s+/).filter(Boolean));c.forEach(x=>q.delete(x));s._class=[...q].join(" ")},toggle(){},contains:c=>s._class.split(/\s+/).includes(c)}}
    get textContent(){return this.children.length?this.children.map(c=>c.textContent).join(""):this._text} set textContent(v){this._text=String(v);this.children=[]}
    get firstElementChild(){return this.children[0]}
    appendChild(c){c.parent=this;this.children.push(c);return c}
    setAttribute(k,v){this.attrs[k]=v}
    addEventListener(t,f){(this.listeners[t]||=[]).push(f)}
    dispatch(t,ev={}){ev.type=t;ev.target||=this;ev.preventDefault||=()=>{};ev.currentTarget=this;(this.listeners[t]||[]).forEach(f=>f.call(this,ev));if(typeof this["on"+t]==="function")this["on"+t](ev)}
    matches(){return false} closest(){return null} descendants(){return []}
    querySelector(){return null} querySelectorAll(){return []}
    get innerHTML(){return ""} set innerHTML(v){this.children=[]}
    showModal(){} close(){} };

  const registry={};
  for(const m of html.matchAll(/<(\w+)[^>]*\bid="([\w-]+)"/g)){const e=new El(m[1]);e.id=m[2];e.attrs.id=m[2];registry[m[2]]=e;}

  const sent=[];
  const mkOut=(n,i)=>({id:"o"+i,name:n,send(m){sent.push({port:n,bytes:[...m]})}});
  const mkIn=(n,i)=>({id:"i"+i,name:n,onmidimessage:null});
  const access={outputs:new Map(outNames.map((n,i)=>["o"+i,mkOut(n,i)])),
                inputs:new Map(inNames.map((n,i)=>["i"+i,mkIn(n,i)])),onstatechange:null};

  const ls={_d:{...storeSeed},getItem(k){return k in this._d?this._d[k]:null},setItem(k,v){this._d[k]=String(v)}};
  const document={getElementById:id=>registry[id]||null,createElement:t=>new El(t),querySelector:()=>null,addEventListener(){}};
  const g={document,window:{addEventListener(){}},navigator:{requestMIDIAccess:async()=>access},
    performance:{now:()=>1000},requestAnimationFrame:cb=>setTimeout(cb,0),setTimeout,clearTimeout,console,
    fetch:async()=>({ok:false}),isSecureContext:true,Blob,Response,DecompressionStream,TextDecoder,
    localStorage:ls,Uint8Array,DataView,Promise,Math,JSON,Date,Number,String,Object,Array,Set,Error};
  new Function(...Object.keys(g), appJs)(...Object.values(g));
  return {registry,sent,access,ls};
}

const results=[];
const t=(n,c,x="")=>results.push((c?"✓ ":"✗ ")+n+(x?" — "+x:""));

// 1. Linux: loopback first, reface second
let e = makeEnv(["Midi Through Port-0","reface DX MIDI 1"],[]);
await new Promise(r=>setTimeout(r,30));
t("picks reface over 'Midi Through' listed first", e.registry.port.value==="o1", e.registry.port.value);

// 2. the old bug: a stale auto-selection stored from a previous session
e = makeEnv(["Midi Through Port-0","reface DX MIDI 1"],[],{port:"o0",portName:"Midi Through Port-0"});
await new Promise(r=>setTimeout(r,30));
t("ignores a stored port that was never chosen by hand", e.registry.port.value==="o1", e.registry.port.value);

// 3. an explicit manual choice IS respected
e = makeEnv(["Midi Through Port-0","reface DX MIDI 1"],[],{portName:"Midi Through Port-0",portManual:"1"});
await new Promise(r=>setTimeout(r,30));
t("respects a deliberate manual choice", e.registry.port.value==="o0", e.registry.port.value);
t("warns that the manual choice is a loopback", /loopback/.test(e.registry.status.textContent), e.registry.status.textContent);

// 4. manual selection persists by NAME, so it survives id reshuffling
e.registry.port.value="o1"; e.registry.port.dispatch("change");
t("manual pick stored by name", e.ls._d.portName==="reface DX MIDI 1", e.ls._d.portName);

// 5. only loopbacks available
e = makeEnv(["Midi Through Port-0","loopMIDI Port"],[]);
await new Promise(r=>setTimeout(r,30));
t("flags an all-loopback setup", /loopback/.test(e.registry.status.textContent), e.registry.status.textContent);
t("lamp shows error for loopback", e.registry.lamp.className.includes("err"));

// 6. unknown interface name — neutral, not claimed as reface
e = makeEnv(["USB MIDI Interface"],[]);
await new Promise(r=>setTimeout(r,30));
t("neutral message for unrecognised port", /no reface in the name/.test(e.registry.status.textContent), e.registry.status.textContent);

// 7. identity probe: loopback echoes our own request back
e = makeEnv(["Midi Through Port-0"],["Midi Through Port-0"]);
await new Promise(r=>setTimeout(r,30));
const probe = e.sent.find(s=>s.bytes[1]===0x7E);
t("identity request sent", !!probe, probe?probe.bytes.map(b=>b.toString(16)).join(" "):"none");
const loopIn = e.access.inputs.get("i0");
loopIn.onmidimessage({data:[0xF0,0x7E,0x7F,0x06,0x01,0xF7,0x00]});
t("detects echo of its own request", /loops back/.test(e.registry.status.textContent), e.registry.status.textContent);

// 8. identity probe: a real Yamaha reply
e = makeEnv(["reface DX MIDI 1"],["reface DX MIDI 1"]);
await new Promise(r=>setTimeout(r,30));
e.access.inputs.get("i0").onmidimessage({data:[0xF0,0x7E,0x00,0x06,0x02,0x43,0x00,0x41,0x52,0x06,0xF7]});
t("confirms a Yamaha identity reply", /Confirmed Yamaha/.test(e.registry.status.textContent), e.registry.status.textContent);

// 9. non-Yamaha reply
e = makeEnv(["reface DX MIDI 1"],["reface DX MIDI 1"]);
await new Promise(r=>setTimeout(r,30));
e.access.inputs.get("i0").onmidimessage({data:[0xF0,0x7E,0x00,0x06,0x02,0x41,0x00,0x00,0x00,0x00,0xF7]});
t("rejects a non-Yamaha reply", /not Yamaha/.test(e.registry.status.textContent), e.registry.status.textContent);

// 10. silence is tolerated
e = makeEnv(["reface DX MIDI 1"],["reface DX MIDI 1"]);
await new Promise(r=>setTimeout(r,500));
t("tolerates no reply", /no ID reply/.test(e.registry.status.textContent), e.registry.status.textContent);

results.forEach(r=>console.log("  "+r));
if(results.some(r=>r.startsWith("✗"))) process.exit(1);
