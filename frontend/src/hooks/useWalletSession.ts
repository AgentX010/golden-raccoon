"use client";

import { useEffect, useRef } from "react";
import { useSignMessage } from "wagmi";
import { useWalletSessionContext } from "@/providers/WalletSessionProvider";

type Family = "evm" | "stellar";

type ChallengePayload = {
  nonce: string;
  family: Family;
  walletAddress: string;
  issuedAt: string;
  expiresAt: string;
  network: string | null;
  challenge?: string;
  challengeXdr?: string;
};

export function useWalletSession() {
  const session = useWalletSessionContext();
  const signMessageAsync = useSignMessage().signMessageAsync;
  const address = session.isConnected ? session.address : undefined;
  const family = session.isConnected ? session.family : null;
  const network =
    family === "stellar"
      ? session.stellar.network === "stellar-pubnet"
        ? "Public Global Stellar Network ; September 2015"
        : "Test SDF Network ; September 2015"
      : session.chainId?.toString() ?? "";

  const queueStream = useRef<Promise<unknown>>(Promise.resolve());
  const inflightFor = useRef<string | null>(null);
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    if (!address || !family) {
      lastSynced.current = null;
      inflightFor.current = null;
      return;
    }
    if (lastSynced.current === address) return;
    if (inflightFor.current === address) return;
    inflightFor.current = address;
    const queued = queueStream.current;
    const claimedAtStart = address;

    const next = queued
      .then(async () => {
        if (lastSynced.current && lastSynced.current !== claimedAtStart) {
          await fetch("/api/wallet-session", { method: "DELETE", credentials: "include" }).catch(
            () => undefined,
          );
        }
        await runChallenge(
          claimedAtStart,
          family,
          network,
          signMessageAsync,
          session.stellar.signTransaction,
        );
        lastSynced.current = claimedAtStart;
      })
      .catch((err: unknown) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("wallet session challenge failed", err);
        }
      })
      .finally(() => {
        if (inflightFor.current === claimedAtStart) inflightFor.current = null;
      });

    queueStream.current = next.catch(() => undefined);
  }, [address, family, network, session.stellar.signTransaction, signMessageAsync]);

  return {
    ...session,
    walletCapabilities: session.family === "stellar" ? session.stellar.capabilities : null,
    networkStatus: session.family === "stellar" ? session.stellar.networkStatus : null,
    sessionNotice: session.family === "stellar" ? session.stellar.sessionNotice : null,
  } as const;
}

async function runChallenge(
  walletAddress: string,
  family: Family,
  network: string,
  signMessageAsync: (input: { message: string }) => Promise<string>,
  stellarSignTransaction: (xdr: string) => Promise<string>,
) {
  const nonceResponse = await fetch("/api/wallet-session/nonce", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, family, network: network || undefined }),
  });
  if (!nonceResponse.ok) {
    throw new Error(`challenge_issue_failed:${nonceResponse.status}`);
  }
  const challenge = (await nonceResponse.json()) as ChallengePayload;

  let signature: string | undefined;
  let signedTxXdr: string | undefined;

  if (family === "evm") {
    if (!challenge.challenge) throw new Error("evm_challenge_missing");
    signature = await signMessageAsync({ message: challenge.challenge });
  } else {
    if (!challenge.challengeXdr) throw new Error("stellar_challenge_missing");
    signedTxXdr = await stellarSignTransaction(challenge.challengeXdr);
  }

  const claimResponse = await fetch("/api/wallet-session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress,
      family,
      nonce: challenge.nonce,
      signature,
      signedTxXdr,
      network: network || undefined,
    }),
  });
  if (!claimResponse.ok) {
    const detail = await claimResponse.text().catch(() => "");
    throw new Error(`claim_rejected:${claimResponse.status}:${detail}`);
  }
}
