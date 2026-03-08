export async function checkIsServerUp(healthUrl: string) {
  console.log('checking', healthUrl);

  let ok = false;
  let message = '';
  try {
    const res = await fetch(healthUrl);
    ok = res.ok;
    message = res.statusText;
  } catch (e) {
    if (e instanceof Error) {
      console.error('error:', e.message);
      message = e.message;
    } else {
      console.error('unknown error:', e);
      message = String(e);
    }
  }
  if (!ok) {
    console.error('server is down. try again later.');
  }

  return { ok, message };
}
