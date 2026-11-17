/**
 * `fetch` com tempo limite para serviços externos (mapa, CEP, captcha). Sem isso, um serviço que
 * não responde deixa a tela "carregando" para sempre. O erro de tempo esgotado é o do navegador
 * (`TimeoutError`, "...timeout"), que `userErrorMessage` já traduz como falha de conexão.
 *
 * `retries`: novas tentativas com espera crescente (400 ms, 800 ms…), SÓ para leituras que podem
 * ser repetidas sem efeito colateral (buscar endereço, consultar CEP). Nunca em envio, pagamento ou
 * verificação de captcha (o token só vale uma vez). Repete em falha de rede, tempo esgotado ou
 * resposta 5xx; não repete 4xx nem quando quem chamou cancelou (`init.signal`).
 */
export interface TimeoutFetchOptions {
  retries?: number;
  backoffMs?: number;
  /** Para testes; padrão: o `fetch` global do momento da chamada. */
  baseFetch?: typeof fetch;
}

/** Junta o cancelamento de quem chamou com o tempo limite (sem depender de AbortSignal.any, ausente no iOS antigo). */
function combine(caller: AbortSignal | null | undefined, timeoutMs: number): { signal: AbortSignal; timedOut: () => boolean; done: () => void } {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort(new DOMException(`Serviço externo sem resposta em ${timeoutMs} ms (timeout)`, "TimeoutError"));
  }, timeoutMs);
  const onAbort = () => ctrl.abort(caller?.reason);
  if (caller?.aborted) onAbort();
  else caller?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: ctrl.signal,
    timedOut: () => timedOut,
    done: () => {
      clearTimeout(timer);
      caller?.removeEventListener("abort", onAbort);
    },
  };
}

const wait = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

export function fetchWithTimeout(timeoutMs: number, { retries = 0, backoffMs = 400, baseFetch }: TimeoutFetchOptions = {}): typeof fetch {
  return async (input, init = {}) => {
    const doFetch = baseFetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
    for (let attempt = 0; ; attempt++) {
      const s = combine(init.signal, timeoutMs);
      try {
        const res = await doFetch(input, { ...init, signal: s.signal });
        if (res.status >= 500 && attempt < retries) {
          await wait(backoffMs * 2 ** attempt, init.signal);
          continue;
        }
        return res;
      } catch (err) {
        // Cancelado por quem chamou (ex.: a pessoa continuou digitando): não repete.
        if (init.signal?.aborted) throw err;
        if (attempt >= retries) throw s.timedOut() ? s.signal.reason : err;
        await wait(backoffMs * 2 ** attempt, init.signal);
      } finally {
        s.done();
      }
    }
  };
}
