// Proposed preparation utility based on the documented kokoro-js API.
// NOT integration-tested in this pack. No narration WAVs are delivered.
// Run in a project with kokoro-js and its matching Transformers.js installed.
// Example: node planning/reference/prepare-voices.mjs --out public/audio/voices --limit 2
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const args=process.argv.slice(2);
const value=(flag,fallback)=>{const i=args.indexOf(flag);return i===-1?fallback:args[i+1];};
const out=resolve(value('--out','public/audio/voices'));
const limit=Number(value('--limit','1000'));
if(!Number.isInteger(limit)||limit<1)throw new Error('invalid --limit');
const manifest=JSON.parse(await readFile(new URL('../content/voice-manifest.json',import.meta.url),'utf8'));
if(args.includes('--dry-run')){console.log(JSON.stringify({status:'not_generated',clips:manifest.clips.slice(0,limit).map(c=>c.id),out},null,2));process.exit(0);}
if(args.includes('--offline')){
 const {env}=await import('@huggingface/transformers');
 env.allowRemoteModels=false;
 if(process.env.TLB_MODEL_DIR)env.localModelPath=resolve(process.env.TLB_MODEL_DIR)+'/';
 // Wrapper voice/phonemizer requests require separate verification. This flag
 // alone does NOT establish that every dependency is available offline.
}
const {KokoroTTS}=await import('kokoro-js');
const tts=await KokoroTTS.from_pretrained(manifest.modelId,{dtype:'q8',device:'cpu'});
await mkdir(out,{recursive:true});
const rendered=[];
for(const clip of manifest.clips.slice(0,limit)){
 if(!/^[a-z0-9-]+\.wav$/.test(clip.file))throw new Error('invalid manifest filename');
 const started=performance.now();
 const audio=await tts.generate(clip.text,{voice:clip.voiceId});
 await audio.save(join(out,clip.file));
 rendered.push({...clip,generationMs:Math.round(performance.now()-started)});
 console.log(`Rendered ${clip.id}`);
}
await writeFile(join(out,'rendered-manifest.json'),JSON.stringify({status:'rendered_by_local_tool',modelId:manifest.modelId,clips:rendered},null,2));
