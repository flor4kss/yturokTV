import { copyFile, cp, mkdir, readdir, unlink } from "node:fs/promises";

// Keep the existing GitHub Pages branch deployment working without changing settings.
await mkdir("assets", { recursive: true });
await cp("dist/assets", "assets", { recursive: true });
await cp("dist/art", "art", { recursive: true });
await copyFile("dist/index.html", "index.html");
// Remove only obsolete generated bundle files from the managed asset directory.
const current = new Set(await readdir("dist/assets"));
for (const file of await readdir("assets")) {
  if (
    /^(index|tvController|hls)-[\w-]+\.(js|css)$/.test(file) &&
    !current.has(file)
  )
    await unlink(`assets/${file}`);
}
