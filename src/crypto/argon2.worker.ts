import { argon2id } from "hash-wasm";
import type { WorkerMessage, WorkerResponse } from "./types";

/**
 * Dedicated Web Worker voor Argon2id sleutelafleiding (KEK-A)
 *
 * Voorkomt dat de zware berekening (64 MiB RAM, 3 iteraties, 4 lanes)
 * de UI thread blokkeert.
 */
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const data = e.data;
  if (data.type === "DERIVE_KEY") {
    try {
      const hashBinary = await argon2id({
        password: data.wachtwoord,
        salt: data.salt,
        parallelism: data.params.p,
        iterations: data.params.t,
        memorySize: data.params.m,
        hashLength: data.params.hashLength,
        outputType: "binary",
      });

      const response: WorkerResponse = {
        type: "DERIVE_KEY_SUCCESS",
        id: data.id,
        keyBytes: hashBinary,
      };

      self.postMessage(response);
    } catch (err) {
      const response: WorkerResponse = {
        type: "DERIVE_KEY_ERROR",
        id: data.id,
        error: err instanceof Error ? err.message : String(err),
      };
      self.postMessage(response);
    }
  }
};
