import { ZodSchema } from 'zod';

export class SchemaValidator {
  static extractJson(payload: string): string {
    const trimmed = payload.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }
    return trimmed;
  }

  static parse<T>(payload: string, schema: ZodSchema<T>): T {
    const json = SchemaValidator.extractJson(payload);
    return schema.parse(JSON.parse(json));
  }
}
