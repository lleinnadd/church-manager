import type { Composer } from 'vue-i18n';
import { createMemberSchema } from '#shared/validation/member';

const requiredMessage = (t: Composer['t']) => t('validation.required');

export const buildMemberFormSchema = (t: Composer['t']) => {
  const required = requiredMessage(t);
  return createMemberSchema({
    required,
    cpfInvalid: t('validation.cpfInvalid'),
    rgInvalid: t('validation.rgInvalid'),
    phoneInvalid: t('validation.phoneInvalid'),
  });
};
