import { defineCollection, z } from 'astro:content';

const widgets = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    // Set when a widget is revised after its original publish date.
    updated: z.date().optional(),
    tags: z.array(z.string()),
    // Marks the widget shown in the homepage "this week's pick" hero slot.
    featured: z.boolean().default(false),
  }),
});

export const collections = { widgets };
