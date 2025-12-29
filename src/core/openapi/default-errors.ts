import type { ProblemDetails } from '../../contracts/errors.js';
import { v } from '../../validation/native/schema.js';
import type { Schema } from '../../validation/native/schema.js';

const validationIssueSchema = v.named(
  'ValidationIssue',
  v.object({
    path: v.array(v.string()),
    message: v.string(),
    code: v.string().optional(),
    expected: v.string().optional(),
    received: v.string().optional(),
  }),
);

export const problemDetailsSchema = v.named(
  'ProblemDetails',
  v.object({
    type: v.string().optional(),
    title: v.string(),
    status: v.number().int(),
    detail: v.string().optional(),
    instance: v.string().optional(),
    code: v.string().optional(),
  }),
) as Schema<ProblemDetails>;

export const validationProblemDetailsSchema = v.named(
  'ValidationProblemDetails',
  v.object({
    type: v.string().optional(),
    title: v.string(),
    status: v.number().int(),
    detail: v.string().optional(),
    instance: v.string().optional(),
    code: v.string().optional(),
    issues: v.array(validationIssueSchema).optional(),
  }),
) as Schema<ProblemDetails>;
