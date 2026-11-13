import { defineConfig } from "vite";
// Match static-host directory indexes while retaining the original app routes.
const directoryIndex = (server) => {
  server.middlewares.use((req, _res, next) => {
    if (req.url?.split("?")[0] === "/sample/")
      req.url = req.url.replace("/sample/", "/sample/index.html");
    next();
  });
};
export default defineConfig({
  plugins: [
    {
      name: "sample-directory-index",
      configureServer: directoryIndex,
      configurePreviewServer: directoryIndex,
    },
  ],
});
