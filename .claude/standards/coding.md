# Detective Pulse Coding Standards

## General

- TypeScript only
- Strict mode enabled
- No any unless justified
- Prefer composition over inheritance
- Keep files focused and small

## React

- App Router only
- Server Components by default
- Client Components only when required
- Loading state required
- Error state required
- Empty state required

## Backend

- Validate all inputs
- Never trust client data
- Authorization on server
- Never bypass RLS
- Never expose service role key

## Database

- UUID primary keys
- Foreign keys required
- RLS enabled
- Audit log sensitive actions

## AI

- Structured output
- Prompt versioning
- Retry with limits
- Log AI failures

## Maps

- Google Maps only
- Restrict API keys
- Validate coordinates
- Rate limit GPS updates
