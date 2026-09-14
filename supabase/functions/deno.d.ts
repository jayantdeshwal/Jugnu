// Type definitions for Supabase Edge Functions / Deno environment

declare module 'https://*' {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void
  export const serveListener: any
}

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}
