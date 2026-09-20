import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export function joinRoom(room: string, user: { name: string; color: string }) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(process.env.NEXT_PUBLIC_COLLAB!, room, doc);
  provider.awareness.setLocalStateField("user", user); // live cursors / presence
  const layers = doc.getMap<Y.Map<any>>("layers");
  return { doc, provider, layers, awareness: provider.awareness };
}
