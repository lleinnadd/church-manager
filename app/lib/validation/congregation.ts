import type { Composer } from 'vue-i18n';
import { createCongregationSchema } from '#shared/validation/congregation';

const requiredMessage = (t: Composer['t']) => t('validation.required');

export const buildCongregationFormSchema = (t: Composer['t']) => {
  const required = requiredMessage(t);

  return createCongregationSchema({
    required,
    zipInvalid: t('validation.zipInvalid'),
  });
};
