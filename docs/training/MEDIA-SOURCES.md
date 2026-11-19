# Recording, narration and reproducibility

These are actual local Chromium screen recordings of the NPI frontend, using the repository's intercepted fictional test backend. No production credentials or records are used. GPS is simulated; recorded 1.75-hour examples are fixture values, not the duration of filming. Setup forms are demonstrated without committing production changes. Some screens are held after the interaction to allow the explanation to finish. Headings and captions are added during rendering.

Narration is synthetic female speech conditioned on an Australian-English synthetic reference. It is not a recording of a human instructor, not a celebrity voice and not the Microsoft Natasha service. Accent consistency can vary with synthesis. The online Australian voice endpoint was unavailable, so the recording uses an offline model.

- ZipVoice source/model: https://github.com/k2-fsa/ZipVoice — Apache-2.0.
- Sherpa ONNX runtime/models: https://github.com/k2-fsa/sherpa-onnx; release asset sherpa-onnx-zipvoice-distill-int8-zh-en-emilia.tar.bz2, vocos_24khz.onnx.
- Australian female synthetic reference: Rob VK5TRM, https://github.com/vk5trm/en_AU-VK5TRM/tree/Google-Female-2, Frn/help.wav, transcript Frn/help.txt. Main README identifies Google Cloud Australian English female Neural2-C and declares GPL v2. Source and original audio are available at that repository. No original reference clip is included in the app or video bundle. Audio derivations distributed here are available under GPL-2.0; preserve this attribution and the generation scripts with redistribution.
- Browser: Chromium with Playwright. Rendering: FFmpeg. No third-party music or stock video.

Generation source: scripts/record-role-training.mjs and scripts/render-role-training.py. Install the repository dependencies, start Vite on port 5173, and provide the model paths described in the Python script. The renderer additionally requires sherpa-onnx, soundfile and piper_phonemize. Large model weights are not part of this package. Text instructions and videos do not alter the NPI software licence.

The generation scripts are source snapshots. To reproduce, use the NPI-Alaska repository checkout and retain its public frontend, package.json and tests/helpers/live-fixture.js; place the scripts in scripts/. The bundle is a user handoff, not a preinstalled media build environment. Source repository: https://github.com/neerajparmani-pixel/NPI-Alaska.
