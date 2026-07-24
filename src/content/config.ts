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

// One optional "go deeper" page per widget, keyed by the same slug. Its
// existence is what makes the deep-dive tab appear on the widget page --
// see the "Adding a deep-dive" section in the README.
const deepDives = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = { widgets, deepDives };
