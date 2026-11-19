"""Render actual browser recordings with synthetic narration and readable captions.
Requires sherpa-onnx, soundfile, piper_phonemize, ffmpeg and the model paths
listed in docs/training/MEDIA-SOURCES.md. No production credentials are used.
"""
import os
import json, subprocess, textwrap, re, html, hashlib
from pathlib import Path
import sherpa_onnx, soundfile as sf
from piper_phonemize import phonemize_espeak
ROOT=Path(__file__).resolve().parents[1]; D=ROOT/'docs/operations-v2/training'; OUT=ROOT/'downloads/operations-v2/training'; OUT.mkdir(parents=True,exist_ok=True)
base=Path('/tmp/npi-zipvoice-model');m=base/'sherpa-onnx-zipvoice-distill-int8-zh-en-emilia'
c=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(zipvoice=sherpa_onnx.OfflineTtsZipvoiceModelConfig(encoder=str(m/'encoder.int8.onnx'),decoder=str(m/'decoder.int8.onnx'),vocoder=str(base/'vocos_24khz.onnx'),tokens=str(m/'tokens.txt'),lexicon=str(m/'lexicon.txt')),num_threads=2))
tts=sherpa_onnx.OfflineTts(c);ref,sr=sf.read('/tmp/npi-au-reference/Frn/help.wav',dtype='float32');reference=Path('/tmp/npi-au-reference-text.txt').read_text().strip()
def phonemes(text):return sum(phonemize_espeak(text,'en'),[])
refp=phonemes(reference)
def run(args):subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def stamp(t):return f'{int(t//3600):02}:{int(t%3600//60):02}:{t%60:06.3f}'
allstories=json.loads((D/'stories.json').read_text());titles={'npi':'NPI Admin','sub':'Subcontractor Admin','worker':'Subcontractor Worker'}
for story in allstories:
 role=story['role'];parts=[];elapsed=0;chapters=[];vtt=['WEBVTT\n'];transcript=[f'# {titles[role]} — task instructions','\nActual frontend recording using intercepted fictional responses; GPS and cloud responses simulated. No production data.\n']
 for i,s in enumerate(story['scenes']):
  prefix=D/f'{role}-{i:02}';wav=prefix.with_suffix('.wav');part=prefix.with_suffix('.mp4')
  audio_text=prefix.with_suffix(".spoken.txt")
  if not wav.exists() or not audio_text.exists() or audio_text.read_text()!=s["text"]:
   g=sherpa_onnx.GenerationConfig();g.reference_audio=ref;g.reference_sample_rate=sr;g.reference_text=reference;g.num_steps=8;g.speed=.82;g.tokens=[refp,phonemes(s['text'])];a=tts.generate('',g);sf.write(str(wav),a.samples,a.sample_rate);audio_text.write_text(s['text'])
  if os.getenv("AUDIO_ONLY")=="1":
   print(role,i,"narration ready",flush=True);continue
  audio,sample_rate=sf.read(wav);duration=len(audio)/sample_rate+1.2
  titlefile=prefix.with_suffix('.title.txt');titlefile.write_text(s['title'])
  sentences=re.split(r'(?<=[.!?])\s+',s['text']); total=sum(len(x) for x in sentences);position=.3;subs=[]
  for j,sentence in enumerate(sentences):
   end=position+(duration-.8)*len(sentence)/total
   # VTT stays human readable and selectable; ASS burn-in is generated through SRT.
   vtt.extend([str(len(vtt)),f'{stamp(elapsed+position)} --> {stamp(elapsed+end)}',sentence,''])
   subs.extend([str(j+1),f'{stamp(position).replace(".",",")} --> {stamp(end).replace(".",",")}',textwrap.fill(sentence,90),'']);position=end
  srt=prefix.with_suffix('.srt');srt.write_text('\n'.join(subs))
  rawduration=max(.2,s['end']-s['start']);speed=min(2.4,max(1,(duration-1)/rawduration));
  if story['mobile']:
   visual=f"scale=450:974,pad=540:1280:45:95:color=0x0b1d30"
  else:visual='pad=1280:1000:0:95:color=0x0b1d30'
  heading_size=18 if story['mobile'] else 25
  caption_size=7 if story['mobile'] else 12
  note_size=10 if story['mobile'] else 16
  vf=f"trim=duration={rawduration},setpts={speed}*(PTS-STARTPTS),{visual},fps=24,tpad=stop_mode=clone:stop_duration={duration},drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile={titlefile}:fontcolor=white:fontsize={heading_size}:x=20:y=18,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='TRAINING DATA | GPS + CAMERA SIMULATED':fontcolor=0xe8bd57:fontsize={note_size}:x=20:y=56,subtitles={srt}:force_style='FontName=DejaVu Sans,FontSize={caption_size},PrimaryColour=&HFFFFFF,OutlineColour=&H301D0B,BorderStyle=3,Alignment=2,MarginV=15',fps=24,format=yuv420p"
  run(['ffmpeg','-y','-ss',str(s['start']),'-i',str(D/f'{role}-screen.webm'),'-i',str(wav),'-vf',vf,'-af','loudnorm=I=-16:TP=-1.5:LRA=11,apad','-ar','48000','-t',str(duration),'-c:v','libx264','-preset','ultrafast','-crf','25','-c:a','aac','-b:a','96k',str(part)])
  parts.append(part);chapters.append({'start':elapsed,'title':s['title'],'duration':duration});transcript.extend([f'## {stamp(elapsed)[:8]} — {s["title"]}',s['text'],'']);elapsed+=duration;print(role,i,s['title'],round(duration,1),flush=True)
 if os.getenv('AUDIO_ONLY')=='1':continue
 playlist=D/f'{role}-concat.txt';playlist.write_text(''.join(f"file '{p}'\n"for p in parts));target=OUT/f'{role}-walkthrough.mp4'
 run(['ffmpeg','-y','-f','concat','-safe','0','-i',str(playlist),'-c','copy','-movflags','+faststart',str(target)])
 (OUT/f'{role}-captions.vtt').write_text('\n'.join(vtt));(OUT/f'{role}-instructions.md').write_text('\n'.join(transcript));(OUT/f'{role}-chapters.json').write_text(json.dumps(chapters,indent=2));story['chapters']=chapters;story['duration']=elapsed
if os.getenv('AUDIO_ONLY')!='1':(D/'rendered-stories.json').write_text(json.dumps(allstories,indent=2))
