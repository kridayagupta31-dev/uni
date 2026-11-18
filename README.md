# Batch of 2027 Commits

Students sign up with their school email, pick their university and subject, add a baby photo, tick the consent box, and get a 1080 × 1350 commit graphic. The university's seal, colours and campus photos are pulled in automatically. Admins review everything on a separate posting desk at `/admin`.

## Files

```
netlify.toml
package.json
netlify/functions/api.mjs    logins, submissions, university lookup, admin API
public/index.html            landing page, sign up / log in, graphic builder
public/app.js
public/graphic.js            draws the graphic (+ list of universities and colours)
public/config.js             year, footer text, Instagram handle, subject list
public/admin.html            posting desk (separate admin login)
public/admin.js
public/styles.css
public/favicon.svg
```

Keep the `public` and `netlify/functions` folders exactly as they are.

## Deploy

1. Put these files in a GitHub repo.
2. Netlify → Add new site → Import from Git → pick the repo. Don't change the build settings.
3. Site configuration → Environment variables → add the four below.
4. Deploys → Trigger deploy.
5. Site configuration → Change site name (pick something neutral, e.g. `batchof27commits`).

## Environment variables

| Name | What to put |
|---|---|
| `ALLOWED_DOMAIN` | the school email domain, without the @ |
| `SESSION_SECRET` | any long random string (40+ characters) |
| `ADMIN_EMAILS` | the email(s) allowed into /admin, comma-separated |
| `ADMIN_CODE` | the admin code asked for on the admin login |

The school domain and admin emails only live in these settings, so they never appear in the code or on the site.

## Admin

Go to `yoursite.netlify.app/admin`, enter an admin email and the admin code. This login is separate from student accounts.

On the posting desk you can:
- see each graphic, the baby pic, name, university, subject and whether they consented
- download the graphic or baby pic, copy a ready-made caption
- mark as posted (the student then sees "Posted" and can't edit any more), or move back to the queue
- delete a submission (they can submit again)
- export a CSV, or download everything as a .zip with a captions file
- see who signed up but hasn't made a graphic, and remove an account if someone forgets their password

## Changing things

- Instagram handle: set `instagram` in `public/config.js` to show it on the site and in captions.
- New batch: change `year`, `shortYear`, `footer` and `hashtags` in `public/config.js`, and the "’27" / "2027" text in the two HTML files.
