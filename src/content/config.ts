import { defineCollection, z } from "astro:content";

const commonSchema = z.object({
  title: z.string(),
  description: z.string().min(1),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  slug: z.string().optional(),
  draft: z.boolean().default(false)
});

const notes = defineCollection({
  type: "content",
  schema: commonSchema.extend({
    uploadDate: z.coerce.date().optional(),
    topic: z.string(),
    sourcePath: z.string().optional()
  })
});

const writing = defineCollection({
  type: "content",
  schema: commonSchema.extend({
    type: z.string(),
    sourcePath: z.string().optional()
  })
});

const projects = defineCollection({
  type: "content",
  schema: commonSchema.extend({
    category: z.string().default("未分类"),
    status: z.string().default("In progress"),
    link: z.string().url().optional(),
    featured: z.boolean().default(false),
    imagePath: z.string().optional(),
    imageAlt: z.string().optional()
  })
});

export const collections = {
  notes,
  writing,
  projects
};
