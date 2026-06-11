// Ambient declarations for the Deno runtime globals used by Supabase
// Edge Functions. This file is editor-only (TS / IDE hint) — the Deno
// runtime already provides these symbols at deploy time, so this just
// keeps `tsc --noEmit` and the in-editor TS language service happy.
//
// Reference this file from each edge-function entrypoint with:
//   /// <reference path="../_shared/deno.d.ts" />
// (or via the project's tsconfig "types" / "lib" field).

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Deno {
    interface EnvValues {
      get(key: string): string | undefined;
    }
    const env: EnvValues;
    function serve(handler: (req: Request) => Response | Promise<Response>): void;
    function serve(
      options: { port?: number; hostname?: string },
      handler: (req: Request) => Response | Promise<Response>
    ): void;
  }
}

export {};
