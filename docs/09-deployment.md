# Deployment

Guide to deploying **Ask Linda** to production.

---

## Deployment Options

| Platform    | Recommended | Notes                                      |
| ----------- | ----------- | ------------------------------------------ |
| **Vercel**  | Yes         | Native Next.js support, easiest setup       |
| **Railway** | Yes         | Good for full-stack, supports PG            |
| **Render**  | Yes         | Free tier available                         |
| **AWS**     | Advanced    | EC2/ECS/Amplify — more control, more setup  |
| **Docker**  | Advanced    | Self-hosted deployment                       |

---

## Deploying to Vercel (Recommended)

### 1. Push Code to GitHub

Make sure your code is in a Git repository:

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Import Project on Vercel

1. Go to [vercel.com](https://vercel.com/) and sign in
2. Click **Add New → Project**
3. Import your GitHub repository
4. Vercel auto-detects Next.js — no build configuration needed

### 3. Set Environment Variables

In the Vercel dashboard, go to **Settings → Environment Variables** and add all variables from your `.env` file:

| Variable                          | Value                          |
| --------------------------------- | ------------------------------ |
| `DATABASE_URL`                    | Your PostgreSQL connection URL |
| `OPENAI_API_KEY`                  | Your OpenAI API key            |
| `NEXT_S3_UPLOAD_BUCKET`           | S3 bucket name                |
| `NEXT_S3_UPLOAD_REGION`           | S3 region                      |
| `NEXT_S3_UPLOAD_ACCESS_KEY_ID`    | AWS access key                 |
| `NEXT_S3_UPLOAD_SECRET_ACCESS_KEY`| AWS secret key                 |
| `PINECONE_API_KEY`                | Pinecone API key               |
| `CHATBOT_PINECONE_INDEX_NAME`     | `chatbot`                     |
| `LIBRARY_PINECONE_INDEX_NAME`     | `library`                     |
| `COHERE_API_KEY`                  | Cohere API key                 |
| `BETTER_AUTH_SECRET`              | Random secret (32+ chars)      |
| `BETTER_AUTH_URL`                 | Your production URL             |
| `SMTP_HOST`                       | SMTP server host               |
| `SMTP_PORT`                       | `587`                          |
| `SMTP_MAIL`                       | Sender email                   |
| `SMTP_PASSWORD`                   | SMTP password                  |

### 4. Deploy

Click **Deploy**. Vercel will build and deploy your application automatically.

### 5. Run Database Migrations

After the first deploy, run migrations against your production database:

```bash
DATABASE_URL="your-production-db-url" npx drizzle-kit migrate
```

Or connect to your database provider and run the SQL migrations manually.

---

## Deploying to Railway

### 1. Create a Project

1. Go to [railway.app](https://railway.app/)
2. Click **New Project**
3. Select **Deploy from GitHub Repo**
4. Choose your repository

### 2. Add PostgreSQL

1. Click **+ New** → **Database** → **PostgreSQL**
2. Railway provides a `DATABASE_URL` automatically
3. Reference it in your service's environment variables

### 3. Configure Environment

Add all environment variables in the Railway dashboard (same list as Vercel above).

### 4. Set Build Command

```
npm install && npx drizzle-kit migrate && npm run build
```

### 5. Set Start Command

```
npm start
```

---

## Docker Deployment

### Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Enable Standalone Output

Add to `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
};
```

### Build and Run

```bash
docker build -t ask-linda .
docker run -p 3000:3000 --env-file .env ask-linda
```

---

## Production Checklist

### Before Deploying

- [ ] All environment variables are set in the hosting platform
- [ ] Database migrations have been run
- [ ] Pinecone indexes are created with correct dimensions (1536)
- [ ] S3 bucket CORS is configured for your production domain
- [ ] SMTP credentials are tested and working
- [ ] An admin user has been created

### Security

- [ ] `.env` file is **not** committed to git
- [ ] All API keys are rotated from development values
- [ ] S3 bucket is not publicly accessible (presigned URLs are used)
- [ ] HTTPS is enabled (automatic on Vercel/Railway)
- [ ] CORS origins are restricted to your domain

### Performance

- [ ] Database connection pooling is enabled (Neon does this automatically)
- [ ] Images are optimized via Next.js `<Image>` component
- [ ] Static assets are cached appropriately

### Monitoring

- [ ] Check server logs for errors after deployment
- [ ] Test all auth flows (signup, login, password reset, 2FA)
- [ ] Test file upload and document processing
- [ ] Test chat functionality with document search
- [ ] Verify emails are being sent correctly

---

## Custom Domain

### Vercel

1. Go to **Settings → Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. SSL is automatic

### Railway

1. Go to service **Settings → Domains**
2. Add custom domain
3. Update DNS CNAME record
4. SSL is automatic

---

## Updating the Deployment

### Vercel

Push to your main branch — Vercel auto-deploys:

```bash
git push origin main
```

### Railway

Same — Railway auto-deploys from the connected branch.

### Manual

```bash
npm run build
npm start
```

---

## Troubleshooting

| Problem                         | Solution                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| Build fails on deployment       | Check build logs — usually missing env vars or type errors  |
| Database connection timeout     | Ensure DB is accessible from the deployment region          |
| 500 errors in production        | Check deployment logs — often missing environment variables |
| Emails not sending              | Verify SMTP credentials in production env vars              |
| S3 uploads fail                 | Update S3 CORS with production domain                       |
| `NEXT_PUBLIC_*` vars not working | These are embedded at build time — redeploy after changing |

---

**Previous:** [← Authentication](./08-authentication.md)
