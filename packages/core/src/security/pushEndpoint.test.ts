import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./pushEndpoint";

describe("isAllowedPushEndpoint", () => {
  it("aceita os serviços oficiais de push", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-bl2p.notify.windows.com/w/?token=abc",
    ]) expect(isAllowedPushEndpoint(url), url).toBe(true);
  });

  it("recusa qualquer outro endereço", () => {
    for (const url of [
      null,
      "",
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://atacante.example/x",
      "https://fcm.googleapis.com.atacante.example/x",
      "https://atacante.example/https://fcm.googleapis.com/x",
      "https://user@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://127.0.0.1/x",
      "https://FCM.googleapis.com/x",
      "https://fcm.googleapis.com",
      `https://fcm.googleapis.com/${"x".repeat(1000)}`,
    ]) expect(isAllowedPushEndpoint(url), String(url)).toBe(false);
  });
});
