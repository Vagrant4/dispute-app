import { z } from 'zod';

const moneyPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export const nullableMoney = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .superRefine((value, ctx) => {
    if (value === null || value === undefined) return;

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0 || Math.round(value * 100) !== value * 100) {
        ctx.addIssue({
          code: 'custom',
          message: 'Must be a non-negative money value with up to 2 decimal places'
        });
      }
      return;
    }

    if (!moneyPattern.test(value.trim())) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be a non-negative money value with up to 2 decimal places'
      });
    }
  })
  .transform((value) => (typeof value === 'string' ? value.trim() : value));

export const nullableDate = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;

    const parsedDate = parseStrictDate(value);
    if (!parsedDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be a valid date'
      });
      return z.NEVER;
    }

    return parsedDate;
  });

export const requiredDate = z
  .string()
  .trim()
  .min(1, 'startDate is required')
  .transform((value, ctx) => {
    const parsedDate = parseStrictDate(value);
    if (!parsedDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be a valid date'
      });
      return z.NEVER;
    }

    return parsedDate;
  });

export function endDateMustNotBeBeforeStartDate(data: { startDate?: Date; endDate?: Date | null }, ctx: z.RefinementCtx): void {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate must be on or after startDate'
    });
  }
}

function parseStrictDate(value: string): Date | null {
  const dateMatch = dateOnlyPattern.exec(value);
  if (dateMatch) {
    const [, yearText, monthText, dayText] = dateMatch;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return null;
    }

    return date;
  }

  const datetimeResult = z.string().datetime({ offset: true }).safeParse(value);
  if (!datetimeResult.success) return null;

  const inputDatePart = dateOnlyPattern.exec(value.slice(0, 10));
  if (!inputDatePart) return null;

  const [, yearText, monthText, dayText] = inputDatePart;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
