import type { Composer } from 'vue-i18n';
import { createMemberSchema, createMemberRegistrationSchema } from '#shared/validation/member';

const requiredMessage = (t: Composer['t']) => t('validation.required');

export const buildMemberFormSchema = (t: Composer['t'], publicMode = false) => {
  const required = requiredMessage(t);
  const messages = {
    required,
    cpfInvalid: t('validation.cpfInvalid'),
    rgInvalid: t('validation.rgInvalid'),
    phoneInvalid: t('validation.phoneInvalid'),
    dateInvalid: t('validation.dateInvalid'),
  };
  return publicMode
    ? createMemberRegistrationSchema(messages).strip()
    : createMemberSchema(messages);
};
