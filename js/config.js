/* Deployment configuration. This is the only file that differs between
   environments — everything else is identical in every deploy.

   API_BASE empty  -> MOCK MODE: the app runs entirely on the fixtures in
                      data.js. No server needed. This is the current state.
   API_BASE set    -> every read and write goes to that origin instead.
                      Nothing else has to change.

   Example for production:
     API_BASE: "https://api.skyro.ai/v1"
*/
window.SKYRO = window.SKYRO || {};
window.SKYRO.CONFIG = {
  API_BASE: ""
};
