# Al-Madina frontend

Static customer and restaurant workspace pages for Al-Madina.

## Deploy on Vercel

- Connect this repository to the `restaurant-frontend` Vercel project.
- Set the Root Directory to the repository root.
- Use the Other framework preset for the static HTML, CSS, and JavaScript site.
- Keep the output directory at the repository root.

Browser API calls use the same-origin `/api` rewrite in `vercel.json`; keep the
backend destination there pointed at the deployed API. This keeps browser
sessions first-party and allows the backend to set an HttpOnly cookie with
CSRF protection. The Android app keeps using the backend URL directly.

Deploy in this order to avoid breaking sign-in during the two-repository
rollout: deploy the frontend first (it temporarily supports the old bearer API),
then set the exact frontend origin in the backend's `FRONTEND_ORIGIN` variable
and deploy the backend. Once the backend is updated, it rejects browser bearer
tokens and uses the HttpOnly cookie. Use no trailing slash and add preview
origins only when intentionally needed.
