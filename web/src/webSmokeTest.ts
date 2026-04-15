export function isWebSmokeTestPassing(message: string): boolean {
  return message.trim().length > 0;
}
