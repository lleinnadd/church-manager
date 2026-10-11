export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? '';
  // Reject unavailable links before reading files or contacting blob storage.
  await getRegistrationMember(token);
  const parts = await readMultipartFormData(event);
  if (
    !parts ||
    parts.some((part) => part.name !== 'data' && part.name !== 'file') ||
    parts.filter((part) => part.name === 'data').length !== 1 ||
    parts.filter((part) => part.name === 'file').length > 1
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid registration submission' });
  }
  const dataPart = parts.find((part) => part.name === 'data')!;
  let body: unknown;
  try {
    body = JSON.parse(dataPart.data.toString('utf8'));
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid personal information' });
  }
  const file = parts.find((part) => part.name === 'file');
  if (file && (!file.type || !file.data.byteLength)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid photo' });
  }
  return saveMemberRegistration(
    token,
    body,
    file ? { data: file.data, type: file.type! } : undefined,
  );
});
