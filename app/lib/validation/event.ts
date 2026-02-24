import { EventSeriesType } from '@prisma/client';
import { z } from 'zod';
import type { Composer } from 'vue-i18n';

const requiredMessage = (t: Composer['t']) => t('validation.required');

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dayScheduleSchema = z.object({
  date: z.string().min(1),
  startTime: z.string().regex(timePattern),
});

const monthlyRuleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  ordinal: z
    .number()
    .int()
    .min(-1)
    .max(4)
    .refine((value) => value !== 0),
  startTime: z.string().regex(timePattern),
});

const parseMinutes = (value: string) => {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export const buildEventFormSchema = (t: Composer['t']) => {
  const required = requiredMessage(t);

  return z
    .object({
      title: z.string().min(1, { message: required }),
      description: z.string().optional().nullable(),
      congregationId: z.string().min(1, { message: required }),
      departmentId: z.string().optional().nullable(),
      eventType: z.nativeEnum(EventSeriesType, { required_error: required }),
      startsOn: z.string().min(1, { message: required }),
      endsOn: z.string().optional().nullable(),
      sameTimeStart: z.string().optional().nullable(),
      daySchedules: z.array(dayScheduleSchema).optional().default([]),
      monthlyRule: monthlyRuleSchema.optional().nullable(),
    })
    .superRefine((value, context) => {
      if (value.eventType === EventSeriesType.MULTI_DAY && !value.endsOn) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endsOn'],
          message: required,
        });
      }

      if (value.endsOn && value.endsOn < value.startsOn) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endsOn'],
          message: t('validation.eventEndAfterStart'),
        });
      }

      const hasSameTime = Boolean(value.sameTimeStart);

      value.daySchedules?.forEach((schedule, index) => {
        if (!schedule.startTime || Number.isNaN(parseMinutes(schedule.startTime))) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['daySchedules', index, 'startTime'],
            message: required,
          });
        }
      });

      if (value.eventType === EventSeriesType.MONTHLY_RECURRING) {
        if (!value.monthlyRule) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['monthlyRule'],
            message: required,
          });
        }
      }

      if (
        value.eventType === EventSeriesType.SINGLE_DAY &&
        !value.daySchedules?.length &&
        !hasSameTime
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sameTimeStart'],
          message: required,
        });
      }

      if (
        value.eventType === EventSeriesType.MULTI_DAY &&
        !value.daySchedules?.length &&
        !hasSameTime
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sameTimeStart'],
          message: required,
        });
      }
    });
};
