import { build } from "esbuild";
import fs from "node:fs/promises";
await fs.writeFile(
  "/tmp/npi-image-entry.js",
  `import {heicTo} from '${process.cwd()}/node_modules/heic-to/dist/csp/heic-to.js';import UTIF from '${process.cwd()}/node_modules/utif/UTIF.js';export async function convert(file,type){if(type==='image/tiff'){const b=await file.arrayBuffer();const ifds=UTIF.decode(b);UTIF.decodeImage(b,ifds[0]);const rgba=UTIF.toRGBA8(ifds[0]);const c=document.createElement('canvas');c.width=ifds[0].width;c.height=ifds[0].height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),c.width,c.height),0,0);return new Promise(ok=>c.toBlob(ok,'image/jpeg',.9));}return await heicTo({blob:file,type:'image/jpeg',quality:.9});}`,
);
await build({
  entryPoints: ["/tmp/npi-image-entry.js"],
  outfile: "public/live/vendor/image-decoders.js",
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
});
