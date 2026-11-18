// Site settings. Netlify "Keys and secrets" (environment variables) override these if you ever add them.
// Keep this repo PRIVATE, because the admin code and secret are in here.
export default {
  // school email domain, without the @
  ALLOWED_DOMAIN: "kchigh.com",

  // emails allowed into /admin, comma-separated
  ADMIN_EMAILS: "kridayagupta@kchigh.com",

  // the code asked for on the admin login. Change it to anything you like.
  ADMIN_CODE: "batch27-feebf0",

  // signs logins so they can't be faked. Leave as is.
  SESSION_SECRET: "MON8DPLMUpVU_WJmZl3rmRhidgM28OGey_u-JeGB9BXhOoPW",
};
