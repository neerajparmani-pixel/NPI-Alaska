if (location.pathname.replace(/\/$/, "") === "/login") {
  await import("./login.js");
} else {
  await import("./app.js");
}
