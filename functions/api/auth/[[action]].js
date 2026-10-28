import { handleAuth } from "../../../server/auth.js";
export const onRequest = ({ request, env, params }) =>
  handleAuth(
    request,
    env,
    Array.isArray(params.action) ? params.action.join("/") : params.action,
  );
