export async function checkIsServerUp(healthUrl: string) {
  console.log('checking', healthUrl);

  let ok = false;
  try {
    const res = await fetch(healthUrl);
    ok = res.ok;
  } catch (e) {
    if (e instanceof Error) {
      console.error('error:', e.message);
    } else {
      console.error('unknown error:', e);
    }
  }
  if (!ok) {
    console.error('server is down. try again later.');
    process.exit(1);
  }
}
