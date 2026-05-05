export async function checkHttp(url: string, timeoutSeconds = 5): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
    });
    clearTimeout(timeout);
    return response.status < 400;
  } catch {
    return false;
  }
}
