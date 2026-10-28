// Requires a separately installed local Ollama model. This probe was not run
// against a real model when preparing the pack. It sends synthetic text only.
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const model=process.env.PRESENTER_MODEL||'gemma3:1b';
const episode=JSON.parse(await readFile(new URL('../content/episode-01.json',import.meta.url),'utf8'));
const system=await readFile(new URL('../prompts/presenter-system.txt',import.meta.url),'utf8');
const question=episode.rounds[0].questions[0];
const schema={type:'object',properties:{hostLine:{type:'string',minLength:8,maxLength:180}},required:['hostLine'],additionalProperties:false};
const start=performance.now();
try{
 const res=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify({question:question.prompt,objection:question.objection,answerKind:'text',answer:'Blue'})}],format:schema,stream:false,keep_alive:'10m',options:{temperature:0.65,num_predict:80,num_ctx:2048}}),signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw new Error(`local_model_http_${res.status}`);
 const raw=await res.json();const parsed=JSON.parse(raw.message.content);
 if(!parsed||Object.keys(parsed).length!==1||typeof parsed.hostLine!=='string'||parsed.hostLine.length<8||parsed.hostLine.length>180||parsed.hostLine.trim().split(/\s+/u).length>18)throw new Error('invalid_short_output');
 console.log(JSON.stringify({dialogueSource:'model',model,hostLine:parsed.hostLine,wallMs:Math.round(performance.now()-start),runtimeTotalNs:raw.total_duration,doneReason:raw.done_reason},null,2));
}catch(error){console.error(JSON.stringify({status:'failed',model,wallMs:Math.round(performance.now()-start),reason:error.name==='TimeoutError'?'generation_budget_exceeded':error.message}));process.exitCode=1;}
