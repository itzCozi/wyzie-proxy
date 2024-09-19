import { H3Event, EventHandlerRequest } from "h3";

export async function sendJson({
  event,
  data,
  status = 200,
}: {
  event: H3Event<EventHandlerRequest>;
  data: Record<string, any>;
  status?: number;
}) {
  setResponseStatus(event, status);
  await send(event, JSON.stringify(data, null, 2), "application/json");
}
