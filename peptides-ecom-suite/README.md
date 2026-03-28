# fireking-ecom-suite

React/Vite storefront + admin UI wired to `ecom_api`.

## Run locally

1. Start API stack from repo root:

```sh
npm run dev
```

2. In a second terminal, configure frontend env:

```sh
cp fireking-ecom-suite/.env.example fireking-ecom-suite/.env
```

3. Install frontend dependencies and run:

```sh
npm install --prefix fireking-ecom-suite
npm run dev:fireking
```

Default API URL is `http://localhost:3000`.

## Current backend wiring

- Store catalog: categories + products
- Customer auth: register/login/logout/me
- Cart: get/add/update/remove
- Orders: customer order history
- Checkout: API path enabled (pickup flow), local fallback remains for non-auth/demo mode
- API CORS is enabled in `apps/api` for local cross-origin dev

## Remaining backend gaps

See [`MISSING_ENDPOINTS.md`](./MISSING_ENDPOINTS.md).
