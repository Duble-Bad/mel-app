import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { petInputSchema, sightingInputSchema } from "@mel/core";
import { ensureSession } from "../src/auth";
import {
  getConversation,
  listMessages,
  listMyConversations,
  markConversationRead,
  myConversationForCase,
  openConversationFromSighting,
  reportConversation,
  sendMessage,
  setConversationBlocked,
  startConversation,
} from "../src/chat";
import { activateLostCase, startLostCase, updateLostCase } from "../src/lostCases";
import { listNotifications, markAllNotificationsRead } from "../src/notifications";
import { createPet } from "../src/pets";
import { createSighting, getTimeline } from "../src/sightings";
import { anonClient, createTestUser, serviceClient } from "./helpers";

const SE = { lat: -23.55052, lng: -46.633308 };
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let tutor: Awaited<ReturnType<typeof createTestUser>>;
let helper: Awaited<ReturnType<typeof createTestUser>>;
let stranger: Awaited<ReturnType<typeof createTestUser>>;
let code: string;
let noChatCode: string;
const anonUsers: string[] = [];

async function anonymousVisitor() {
  const client = anonClient();
  const user = await ensureSession(client);
  anonUsers.push(user.id);
  return { client, id: user.id };
}

async function activeAlert(name: string, contactChat = true) {
  const pet = await createPet(tutor.client, tutor.id, petInputSchema.parse({ name, species: "dog" }));
  const c = await startLostCase(tutor.client, tutor.id, pet.id);
  await updateLostCase(tutor.client, c.id, { lastSeen: SE, lostAt: minutesAgo(60), publicAreaLabel: "Sé, São Paulo – SP", contactChat });
  return (await activateLostCase(tutor.client, c.id)).code;
}

beforeAll(async () => {
  tutor = await createTestUser("chat-tutor");
  helper = await createTestUser("chat-helper");
  stranger = await createTestUser("chat-stranger");
  await serviceClient().from("profiles").update({ display_name: "Carlos Exemplo" }).eq("id", helper.id);
  code = await activeAlert("Mel");
  noChatCode = await activeAlert("Thor", false);
});

afterAll(async () => {
  for (const id of anonUsers) await serviceClient().auth.admin.deleteUser(id);
  await tutor?.cleanup();
  await helper?.cleanup();
  await stranger?.cleanup();
});

describe("conversation between helper and tutor", () => {
  let convId: string;

  it("helper starts the conversation; the tutor is notified and sees it", async () => {
    await markAllNotificationsRead(tutor.client, tutor.id);
    convId = await startConversation(helper.client, code, "  Oi! Acho que vi a Mel na praça.  ");
    // Retomar não cria outra conversa.
    expect(await startConversation(helper.client, code, "Estava com coleira vermelha.")).toBe(convId);
    expect(await myConversationForCase(helper.client, code)).toBe(convId);

    const [n] = await listNotifications(tutor.client, tutor.id);
    expect(n).toMatchObject({ kind: "message_new", title: "💬 Mensagem sobre Mel", href: `/conversas/${convId}` });
    expect(n!.body).toBe("2 mensagens novas. Toque para responder.");

    const [c] = await listMyConversations(tutor.client);
    expect(c).toMatchObject({ id: convId, myRole: "owner", peerName: "Carlos", unread: 2, canSend: true, petName: "Mel" });
    expect(c!.lastMessage).toMatchObject({ body: "Estava com coleira vermelha.", mine: false });

    const msgs = await listMessages(tutor.client, convId);
    expect(msgs.map((m) => m.body)).toEqual(["Oi! Acho que vi a Mel na praça.", "Estava com coleira vermelha."]);
  });

  it("the helper never sees the tutor's name", async () => {
    const c = await getConversation(helper.client, convId);
    expect(c).toMatchObject({ myRole: "helper", peerName: null });
  });

  it("reading clears the unread count and the notification", async () => {
    await markConversationRead(tutor.client, convId);
    expect((await getConversation(tutor.client, convId))!.unread).toBe(0);
    expect((await listNotifications(tutor.client, tutor.id)).every((n) => n.readAt)).toBe(true);
  });

  it("the tutor replies; the helper gets 'o tutor respondeu'", async () => {
    await sendMessage(tutor.client, convId, tutor.id, "Obrigado! Em qual praça?");
    const [n] = await listNotifications(helper.client, helper.id);
    expect(n!.title).toBe("💬 O tutor de Mel respondeu");
  });

  it("outsiders cannot read or write in the conversation", async () => {
    expect(await listMessages(stranger.client, convId)).toEqual([]);
    expect(await getConversation(stranger.client, convId)).toBeNull();
    await expect(sendMessage(stranger.client, convId, stranger.id, "oi")).rejects.toThrow();
    // Nem se passando por outra pessoa.
    await expect(sendMessage(helper.client, convId, tutor.id, "sou o tutor")).rejects.toThrow();
    const { data } = await anonClient().from("messages").select("id").eq("conversation_id", convId);
    expect(data ?? []).toEqual([]);
  });

  it("nobody can create conversations or reports directly", async () => {
    const { error } = await stranger.client
      .from("conversations")
      .insert({ lost_case_id: crypto.randomUUID(), owner_id: tutor.id, helper_id: stranger.id, created_by: stranger.id } as never);
    expect(error).not.toBeNull();
    const { error: reportError } = await stranger.client
      .from("reports")
      .insert({ reporter_id: stranger.id, target_type: "user", target_id: tutor.id, reason: "spam" } as never);
    expect(reportError).not.toBeNull();
  });

  it("blocking stops messages both ways without revealing who blocked", async () => {
    await setConversationBlocked(tutor.client, convId, true);
    expect((await getConversation(tutor.client, convId))!).toMatchObject({ blockedByMe: true, canSend: false });
    const seenByHelper = (await getConversation(helper.client, convId))!;
    expect(seenByHelper).toMatchObject({ blockedByMe: false, canSend: false });
    await expect(sendMessage(helper.client, convId, helper.id, "oi?")).rejects.toThrow("Esta conversa não aceita novas mensagens.");
    await expect(sendMessage(tutor.client, convId, tutor.id, "oi?")).rejects.toThrow("Esta conversa não aceita novas mensagens.");
    // O bloqueado não consegue ler a lista de bloqueios.
    const { data } = await helper.client.from("blocks").select("*");
    expect(data).toEqual([]);

    await setConversationBlocked(tutor.client, convId, false);
    await sendMessage(helper.client, convId, helper.id, "Na Praça da Sé, perto da catedral.");
  });

  it("report: the reporter sees it; it blocks by default", async () => {
    const id = await reportConversation(helper.client, convId, { reason: "scam", details: "Pediu PIX", block: true });
    const { data } = await helper.client.from("reports").select("id, reason, status, target_id").eq("id", id).single();
    expect(data).toMatchObject({ reason: "scam", status: "OPEN", target_id: tutor.id });
    expect((await getConversation(helper.client, convId))!.blockedByMe).toBe(true);
    const { data: others } = await tutor.client.from("reports").select("id");
    expect(others).toEqual([]);
    await setConversationBlocked(helper.client, convId, false);
  });
});

describe("rules for starting a conversation", () => {
  it("not on alerts where the tutor turned the chat off, nor on your own alert", async () => {
    await expect(startConversation(helper.client, noChatCode, "oi")).rejects.toThrow("O tutor não está recebendo mensagens pelo chat.");
    await expect(startConversation(tutor.client, code, "oi")).rejects.toThrow("Este alerta é seu.");
    await expect(startConversation(helper.client, "zzzzzz", "oi")).rejects.toThrow("Este alerta não está mais ativo.");
  });

  it("requires a session and a non-empty message", async () => {
    const { error } = await anonClient().rpc("start_conversation", { p_code: code, p_body: "oi" });
    expect(error).not.toBeNull();
    await expect(startConversation(stranger.client, code, "   ")).rejects.toThrow();
  });
});

describe("tutor replying to an anonymous sighting", () => {
  it("opens a conversation with the reporter, who sees it after the first message", async () => {
    const visitor = await anonymousVisitor();
    await createSighting(
      visitor.client,
      sightingInputSchema.parse({ code, position: { lat: -23.5489, lng: -46.6388 }, seenAt: minutesAgo(5) }),
    );
    const sighting = (await getTimeline(tutor.client, code)).at(-1)!;
    expect(sighting.canReply).toBe(true);
    expect((await getTimeline(visitor.client, code)).at(-1)!.canReply).toBe(false);

    const convId = await openConversationFromSighting(tutor.client, sighting.id);
    expect(await openConversationFromSighting(tutor.client, sighting.id)).toBe(convId);
    // Vazia: ainda não aparece para quem enviou o avistamento.
    expect(await listMyConversations(visitor.client)).toEqual([]);
    await expect(openConversationFromSighting(stranger.client, sighting.id)).rejects.toThrow("Avistamento não encontrado.");

    await sendMessage(tutor.client, convId, tutor.id, "Obrigado! Ela estava indo para onde?");
    const [c] = await listMyConversations(visitor.client);
    expect(c).toMatchObject({ id: convId, myRole: "helper", unread: 1 });
    expect((await getConversation(tutor.client, convId))!).toMatchObject({ peerName: null, peerIsAnonymous: true, fromSighting: true });
    await sendMessage(visitor.client, convId, visitor.id, "Para a Rua Direita.");
  });
});

describe("antispam", () => {
  it("limits messages per minute", async () => {
    const convId = await startConversation(stranger.client, code, "mensagem 1");
    let error: unknown;
    for (let i = 2; i <= 21 && !error; i++) {
      try {
        await sendMessage(stranger.client, convId, stranger.id, `mensagem ${i}`);
      } catch (err) {
        error = err;
      }
    }
    expect(String(error)).toContain("Você enviou muitas mensagens seguidas");
  });
});
