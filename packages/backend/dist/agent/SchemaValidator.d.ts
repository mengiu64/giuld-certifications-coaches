import { ZodSchema } from 'zod';
export declare class SchemaValidator {
    static extractJson(payload: string): string;
    static parse<T>(payload: string, schema: ZodSchema<T>): T;
}
