import { H3Event, Duplex, ProxyOptions, getProxyRequestHeaders, RequestHeaders } from "h3";

const PayloadMethods = new Set(["PATCH", "POST", "PUT", "DELETE"]);

export interface ExtraProxyOptions {
  blacklistedHeaders?: string[];
}

function mergeHeaders(
  defaults: HeadersInit,
  ...inputs: (HeadersInit | RequestHeaders | undefined)[]
): Headers {
  const merged: Record<string, string> = {};

  if (defaults instanceof Headers) {
    defaults.forEach((value, key) => {
      merged[key] = value;
    });
  } else {
    Object.assign(merged, defaults);
  }

  for (const input of inputs) {
    if (!input) continue;

    if (input instanceof Headers) {
      input.forEach((value, key) => {
        if (value !== undefined) {
          merged[key] = value;
        }
      });
    } else {
      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined) {
          merged[key] = value;
        }
      });
    }
  }

  return new Headers(merged);
}

export async function specificProxyRequest(
  event: H3Event,
  target: string,
  opts: ProxyOptions & ExtraProxyOptions = {},
) {
  let body;
  let duplex: Duplex | undefined;
  if (PayloadMethods.has(event.method)) {
    if (opts.streamRequest) {
      body = getRequestWebStream(event);
      duplex = "half";
    } else {
      try {
        body = await readRawBody(event, false);
      } catch {
        body = undefined;
      }
    }
  }

  const method = opts.fetchOptions?.method || event.method;
  const oldHeaders = getProxyRequestHeaders(event);

  if (opts.blacklistedHeaders) {
    const blacklistedHeadersSet = new Set(
      opts.blacklistedHeaders.map((header) => header.toLowerCase()),
    );
    const oldHeaderKeys = Object.keys(oldHeaders);
    for (const key of oldHeaderKeys) {
      if (blacklistedHeadersSet.has(key.toLowerCase())) {
        delete oldHeaders[key];
      }
    }
  }

  const fetchHeaders = mergeHeaders(oldHeaders, opts.fetchOptions?.headers, opts.headers);

  const headerObj = Object.fromEntries([...(fetchHeaders.entries as any)()]);
  if (process.env.REQ_DEBUG === "true") {
    console.log({
      type: "request",
      method,
      url: target,
      headers: headerObj,
    });
  }

  return sendProxy(event, target, {
    ...opts,
    fetchOptions: {
      method,
      body,
      duplex,
      ...opts.fetchOptions,
      headers: fetchHeaders,
    },
  });
}
