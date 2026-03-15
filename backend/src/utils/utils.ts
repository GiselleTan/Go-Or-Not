export const extractError = (
  result: PromiseSettledResult<unknown>,
): string | undefined => {
  if (result.status === 'fulfilled') return undefined;
  return result.reason instanceof Error
    ? result.reason.message
    : 'Unknown error';
};
