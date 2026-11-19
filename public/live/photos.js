// Shared multi-photo camera/file queue. Originals never receive a permanent stamp.
const MAX = 20 * 1024 * 1024;
const TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/gif",
  "image/bmp",
  "image/avif",
  "application/pdf",
];
export function fileType(file) {
  if (TYPES.includes(file.type)) return file.type;
  const aliases = {
    "image/jpg": "image/jpeg",
    "image/x-ms-bmp": "image/bmp",
    "image/x-tiff": "image/tiff",
    "image/heic-sequence": "image/heic",
    "image/heif-sequence": "image/heif",
  };
  if (aliases[file.type]) return aliases[file.type];
  if (file.type && file.type !== "application/octet-stream") return "";
  return (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
      tif: "image/tiff",
      tiff: "image/tiff",
      gif: "image/gif",
      bmp: "image/bmp",
      avif: "image/avif",
      pdf: "application/pdf",
    }[file.name.split(".").pop().toLowerCase()] || ""
  );
}
export async function previewImage(file) {
  const type = fileType(file);
  let blob = file;
  if (["image/heic", "image/heif", "image/tiff"].includes(type)) {
    const { convert } = await import("./vendor/image-decoders.js");
    blob = await convert(file, type);
  }
  const image = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  const factor = Math.min(1, 1800 / Math.max(image.width, image.height));
  c.width = Math.max(1, Math.round(image.width * factor));
  c.height = Math.max(1, Math.round(image.height * factor));
  c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
  image.close();
  return c;
}
export async function stampedPreview(file, meta) {
  const base = await previewImage(file);
  const c = document.createElement("canvas");
  const w = Math.max(640, base.width),
    ratio = w / base.width;
  c.width = w;
  c.height = Math.round(base.height * ratio) + 150;
  const x = c.getContext("2d");
  x.drawImage(base, 0, 0, w, c.height - 150);
  x.fillStyle = "#102c50";
  x.fillRect(0, c.height - 150, w, 150);
  x.fillStyle = "#fff";
  x.font = "22px sans-serif";
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Anchorage",
    dateStyle: "medium",
    timeStyle: "long",
  }).format(new Date(meta.time));
  [
    meta.site + " · " + meta.stage,
    meta.worker,
    (meta.source === "app-camera"
      ? "Captured in app (device): "
      : "Upload prepared (device): ") + date,
  ].forEach((t, i) => x.fillText(t, 20, c.height - 112 + i * 36, w - 40));
  return new Promise((ok, no) =>
    c.toBlob(
      (b) => (b ? ok(b) : no(Error("Preview conversion failed"))),
      "image/jpeg",
      0.86,
    ),
  );
}
export class PhotoQueue {
  constructor({ root, api, work, profile, site, onSaved, markDirty }) {
    Object.assign(this, { root, api, work, profile, site, onSaved, markDirty });
    this.items = [];
    this.stream = null;
    this.uploading = false;
    this.batchStage = null;
  }
  mount() {
    this.root.innerHTML = `<p>Take several pictures one by one, or choose multiple files. Originals are preserved. Up to 12 files / 60 MB per batch; 20 MB per file. Common images and PDF timecards are supported.</p><label for="photo-stage">Evidence category</label><select id="photo-stage"><option value="before">Before work</option><option value="progress">Progress</option><option value="after">After work</option><option value="issue">Issue evidence</option><option value="timecard">Timecard / PDF</option></select><label for="photo-issue">Related issue (optional)</label><select id="photo-issue"><option value="">No linked issue</option></select><div class="actions"><button class="btn primary" id="start-camera" type="button">Take photo</button><button class="btn" id="choose-files" type="button">Choose files</button><input id="multi-files" type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/tiff,image/gif,image/bmp,image/avif,application/pdf"></div><div id="camera-view" hidden><video id="camera-feed" autoplay playsinline muted aria-label="Camera preview"></video><div class="actions"><button type="button" class="btn primary" id="capture-photo">Capture photo</button><button type="button" class="btn" id="stop-camera">Close camera</button></div></div><div id="capture-review" hidden><img id="capture-image" alt="New photo preview"><div class="actions"><button class="btn primary" type="button" id="keep-photo">Keep photo</button><button class="btn" type="button" id="retake-photo">Retake</button></div></div><p id="photo-status" role="status" aria-live="polite"></p><div id="photo-queue" class="photo-grid"></div><button class="btn primary" id="upload-batch" type="button">Upload photos / retry failed</button>`;
    this.$ = (s) => this.root.querySelector(s);
    this.$("#choose-files").onclick = () => this.$("#multi-files").click();
    this.$("#start-camera").onclick = () => this.camera();
    this.$("#stop-camera").onclick = () => this.stop();
    this.$("#capture-photo").onclick = () => this.capture();
    this.$("#keep-photo").onclick = async () => {
      if (this.keeping) return;
      this.keeping = true;
      this.$("#keep-photo").disabled = true;
      try {
        await this.add(this.candidate.file, this.candidate);
        this.$("#capture-review").hidden = true;
        await this.camera();
      } catch (e) {
        this.status(e.message);
      } finally {
        this.keeping = false;
        if (this.root.isConnected) this.$("#keep-photo").disabled = false;
      }
    };
    this.$("#retake-photo").onclick = () => {
      this.$("#capture-review").hidden = true;
      this.camera();
    };
    this.$("#multi-files").onchange = async (e) => {
      for (const file of e.target.files) {
        try {
          await this.add(file, {
            source: "file",
            time: new Date().toISOString(),
          });
        } catch (err) {
          this.status(err.message);
          break;
        }
      }
      e.target.value = "";
    };
    this.$("#upload-batch").onclick = () => this.upload();
    this.root.addEventListener("click", (e) => {
      const el = e.target.closest("[data-photo-remove]");
      if (el && !this.uploading) {
        const item = this.items.find((i) => i.id === el.dataset.photoRemove);
        if (item && item.status !== "Saved") {
          URL.revokeObjectURL(item.url);
          this.items = this.items.filter((i) => i !== item);
          this.draw();
        }
      }
    });
    this.draw();
  }
  status(text) {
    this.$("#photo-status").textContent = text;
  }
  async camera() {
    if (this.disposed || this.uploading || this.cameraPending) return;
    this.cameraPending = true;
    try {
      this.stop();
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Camera unavailable. Use Choose files or your phone camera, then select the pictures.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (
        this.disposed ||
        !this.root.isConnected ||
        document.visibilityState !== "visible"
      ) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.$("#camera-feed").srcObject = this.stream;
      this.$("#camera-view").hidden = false;
      this.status(
        "Capture, keep or retake each photo. Take another when ready.",
      );
    } catch (e) {
      this.status(
        "Camera access unavailable. Allow camera permission or use Choose files.",
      );
    } finally {
      this.cameraPending = false;
    }
  }
  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.$) {
      this.$("#camera-view").hidden = true;
      this.$("#camera-feed").srcObject = null;
    }
  }
  async capture() {
    const v = this.$("#camera-feed");
    if (!v.videoWidth) return this.status("Wait for the camera preview.");
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const captured_at = new Date().toISOString();
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.93));
    if (!blob) return this.status("Photo capture failed. Retry.");
    if (this.candidate?.url) URL.revokeObjectURL(this.candidate.url);
    const file = new File([blob], "camera-" + Date.now() + ".jpg", {
      type: "image/jpeg",
    });
    this.candidate = { file, source: "app-camera", time: captured_at };
    this.candidate.url = URL.createObjectURL(blob);
    this.$("#capture-image").src = this.candidate.url;
    this.$("#capture-review").hidden = false;
    this.stop();
  }
  async add(file, meta) {
    if (this.disposed || this.uploading)
      throw Error("Wait for the current upload to finish.");
    if (this.items.length >= 12)
      throw Error("Upload this batch before adding more than twelve files.");
    if (
      this.items.reduce((n, i) => n + i.file.size, 0) + file.size >
      60 * 1024 * 1024
    )
      throw Error("This batch exceeds 60 MB. Upload a smaller batch.");
    const mime = fileType(file);
    if (!mime || file.size < 1 || file.size > MAX)
      throw Error(
        "Unsupported file or file over 20 MB. Choose JPG, PNG, WebP, HEIC/HEIF, TIFF, GIF, BMP, AVIF or a PDF timecard.",
      );
    if (
      mime === "application/pdf" &&
      this.$("#photo-stage").value !== "timecard"
    )
      throw Error("Choose Timecard / PDF for documents.");
    const time = meta.time;
    this.status("Preparing " + file.name + "…");
    const preview =
      mime === "application/pdf"
        ? null
        : await stampedPreview(file, {
            time,
            source: meta.source,
            worker: this.profile.display_name,
            site: this.site.name,
            stage: this.$("#photo-stage").value,
          });
    this.items.push({
      id: crypto.randomUUID(),
      file,
      preview,
      source: meta.source,
      time,
      mime,
      stage: this.$("#photo-stage").value,
      issue_id: this.$("#photo-issue").value || null,
      status: "Waiting",
      url: preview ? URL.createObjectURL(preview) : "",
    });
    this.markDirty();
    this.draw();
    this.status(this.items.length + " files ready. Add more or upload.");
  }
  draw() {
    const list = this.$("#photo-queue");
    list.replaceChildren();
    for (const item of this.items) {
      const article = document.createElement("article");
      article.className = "photo-card";
      if (item.url) {
        const img = document.createElement("img");
        img.src = item.url;
        img.alt = "Prepared " + item.stage + " evidence";
        article.append(img);
      }
      const text = document.createElement("p");
      text.textContent =
        item.file.name + " · " + item.stage + " · " + item.status;
      article.append(text);
      if (item.status !== "Saved") {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.textContent = "Remove";
        b.dataset.photoRemove = item.id;
        b.disabled = this.uploading;
        article.append(b);
      }
      list.append(article);
    }
    this.$("#upload-batch").disabled =
      this.uploading || !this.items.some((i) => i.status !== "Saved");
  }
  async upload() {
    if (this.uploading) return;
    this.stop();
    this.uploading = true;
    this.draw();
    let saved = 0;
    for (const item of this.items.filter((i) => i.status !== "Saved")) {
      item.status = "Uploading original…";
      this.draw();
      try {
        await this.api.uploadFieldEvidence(this.work, item, (text) => {
          item.status = text;
          this.draw();
        });
        item.status = "Saved";
        saved++;
      } catch (e) {
        item.status = "Failed: " + e.message;
      }
      this.draw();
    }
    this.uploading = false;
    this.draw();
    const failures = this.items.filter((i) => i.status !== "Saved").length;
    this.status(
      failures
        ? `${saved} saved; ${failures} failed. Retry failed uploads before submitting work.`
        : `${this.items.length} files saved successfully.`,
    );
    await this.onSaved({ saved, failures });
  }
  dispose() {
    this.disposed = true;
    this.stop();
    for (const item of this.items) if (item.url) URL.revokeObjectURL(item.url);
    if (this.candidate?.url) URL.revokeObjectURL(this.candidate.url);
  }
}
