import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  getFutureJobs: publicProcedure.query(async () => {
    // Logique pour récupérer les métiers depuis Supabase
    return [];
  }),
  generateVideo: publicProcedure
    .input(z.object({
      jobId: z.string(),
      promptText: z.string(),
      generator: z.string(),
      style: z.string(),
      duration: z.number(),
    }))
    .mutation(async ({ input }) => {
      // Logique pour appeler l'Edge Function de génération vidéo
      return { status: 'pending', videoUrl: null };
    }),
});
