# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

Create a `.env` file based on `.env.example` and configure at least:

- `DATABASE_URL`
- `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NUXT_CLERK_SECRET_KEY`
- `NUXT_CLERK_WEBHOOK_SIGNING_SECRET`
- `BLOB_READ_WRITE_TOKEN` (required for member 3x4 photo upload)

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

## Member registration links

On a member's edit page, staff with member-update permission can generate a personal
registration link and copy it for sharing. Links default to 48 hours, allow a custom
expiration, and permit one successful save. Generating another link for that member
replaces the previous link. Members do not need an account to use the public page.

The public form requires personal details and a photo; an existing photo can be kept.
Father's name, RG, member-since date, and conversion date are optional in both forms.
Congregation, status, departments, internal observations, and account permissions
remain under staff control. Names connected to Clerk accounts remain locked.

Before deploying this change, generate the Prisma client and synchronize the MongoDB
schema/indexes with the configured deployment database:

```bash
pnpm exec prisma generate
pnpm exec prisma db push
```

No member backfill is needed. `BLOB_READ_WRITE_TOKEN` is required when uploading a new
photo. The registration token hash and lifecycle fields are excluded from ordinary
member responses.

Run the regression suite with `npm test`, or just its MongoDB integration tests with
`npm run test:integration`. Tests start and stop an isolated temporary MongoDB replica
set and never use the configured application database. The first integration run
downloads a MongoDB server binary; local test ports must be allowed.

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
