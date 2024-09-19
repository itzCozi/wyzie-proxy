import { getBodyBuffer } from '@/utils/body';
import {
  getProxyHeaders,
  getAfterResponseHeaders,
  getBlacklistedHeaders,
} from '@/utils/headers';

export default defineEventHandler(async (event) => {
  // handle cors, if applicable
  if (isPreflightRequest(event)) return handleCors(event, {});

  // parse destination URL (https://proxy.io/https://example.com)
  const urlPath = event.path;
  console.log(event.context.clientAddress);
  const destination = urlPath.slice(1);

  // check if the destination is a valid URL
  if (/^(https?:\/\/)/.test(destination)) {
    return await sendJson({ event, status: 400, data: { message: `Invalid URL, did you mean /${destination.replace(/^(https?:\/\/)/, '')}` } });
  }

  // read body
  const body = await getBodyBuffer(event);

  // proxy
  try {
    await specificProxyRequest(event, `https://${destination}`, {
      blacklistedHeaders: getBlacklistedHeaders(),
      fetchOptions: {
        redirect: 'follow',
        headers: getProxyHeaders(event.headers),
        body,
      },
      onResponse(outputEvent, response) {
        const headers = getAfterResponseHeaders(response.headers, response.url);
        setResponseHeaders(outputEvent, headers);
      },
    });
  } catch (e) {
    console.log('Error fetching', e);
    throw e;
  }
});
