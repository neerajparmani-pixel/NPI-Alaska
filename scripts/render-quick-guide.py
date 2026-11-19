"""Render captured app screens with synthetic instructor narration and burned-in captions."""
from pathlib import Path
import concurrent.futures,json,subprocess
root=Path(__file__).resolve().parents[1];work=Path('/tmp/npi-video');out=root/'downloads';out.mkdir(exist_ok=True)
story=json.loads((work/'story.json').read_text())
def run(args):subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def render(scene):
 ident=scene['id'];text=work/f'voice-{ident}.txt';wav=work/f'voice-{ident}.wav';clip=work/f'clip-{ident}.mp4';text.write_text(scene['narration'])
 run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',f'flite=textfile={text}:voice=slt','-af','atempo=0.92,apad=pad_dur=0.7','-ar','44100','-ac','1',str(wav)])
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(wav)],text=True))
 run(['ffmpeg','-hide_banner','-loglevel','error','-y','-loop','1','-framerate','15','-i',str(work/f'scene-{ident}.png'),'-i',str(wav),'-t',str(duration),'-c:v','libx264','-preset','fast','-tune','stillimage','-crf','23','-pix_fmt','yuv420p','-r','15','-c:a','aac','-b:a','80k','-ac','1','-ar','44100','-movflags','+faststart',str(clip)])
 print('Rendered scene',ident,round(duration,1),'seconds',flush=True);return duration
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:durations=list(executor.map(render,story))
concat=work/'clips.txt';concat.write_text('\n'.join(f"file '{work}/clip-{s['id']}.mp4'" for s in story))
run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(out/'NPI-Quick-Guide.mp4')])
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
vtt=['WEBVTT',''];transcript=['# NPI guided walkthrough','','Synthetic English voice instructor; captions are burned into the video.','Screens are captured from the working local sample. Example GPS and photos are simulated. No real invoice or payment is created.',''];pos=0
for scene,duration in zip(story,durations):
 vtt.extend([f'{stamp(pos)} --> {stamp(pos+duration)}',scene['narration'],'']);transcript.extend([f"## {scene['id']}. {scene['title']}",'',scene['narration'],'']);pos+=duration
(out/'NPI-Quick-Guide.vtt').write_text('\n'.join(vtt));(out/'NPI-Quick-Guide-Transcript.md').write_text('\n'.join(transcript))
metadata={'duration_seconds':round(pos,2),'scenes':len(story),'resolution':'1280x800','narration':'synthetic English voice, flite slt','work_result':'DEMO-105, NPI approved, 1.75 accepted hours','bytes':(out/'NPI-Quick-Guide.mp4').stat().st_size};(work/'video-metadata.json').write_text(json.dumps(metadata,indent=2));print(json.dumps(metadata),flush=True)
