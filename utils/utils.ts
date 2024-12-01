/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import os from "os";
import fs from "mz/fs";
import path from "path";
import yaml from "yaml";
import readline from "readline";
import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Message,
  MessageArgs
} from "@solana/web3.js";

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<Connection> {
  const rpcUrl = await getRpcUrl();
  let connection = new Connection(rpcUrl, "confirmed");
  const version = await connection.getVersion();
  console.log("Connection to cluster established:", rpcUrl, version);
  return connection;
}

export async function getBalance(
  connection: Connection,
  payer: Keypair
): Promise<[number, number]> {
  let lamports = await connection.getBalance(payer.publicKey);
  const startingBalanceSOL = lamports / LAMPORTS_PER_SOL;
  return [startingBalanceSOL, lamports];
}

export async function feesEstimate(connection: Connection, payer: Keypair): Promise<number> {
  const { blockhash } = await connection.getLatestBlockhash();

  const messageArgs: MessageArgs = {
    recentBlockhash: blockhash,
    instructions: [],
    header: {
      numRequiredSignatures: 1,
      numReadonlySignedAccounts: 0,
      numReadonlyUnsignedAccounts: 0,
    },
    accountKeys: [payer.publicKey],
  }

  const message = new Message(messageArgs);
  const feeCalculator = await connection.getFeeForMessage(message);

  if (feeCalculator.value === null) {
    throw new Error("Failed to retrieve fee calculator value");
  }
  let fees = feeCalculator.value * 100;

  return fees;
}

export async function topUp(
  connection: Connection,
  payer: Keypair,
  lamports: number
) {
  const sig = await connection.requestAirdrop(payer.publicKey, lamports);
  await connection.confirmTransaction(sig);
  lamports = await connection.getBalance(payer.publicKey);
}

export async function atLeastSol(
  connection: Connection,
  account: Keypair,
  min: number
) {
  const minLampBalance = min * LAMPORTS_PER_SOL;

  let [_, lamports] = await getBalance(connection, account);
  if (lamports < minLampBalance) {
    await topUp(connection, account, minLampBalance - lamports);
  }
}

export async function topUpAccounts(
  connection: Connection,
  accounts: Keypair[],
  minAmount: number = 1
) {
  let minSol = minAmount;

  for (let k = 0; k < accounts.length; k++) {
    await atLeastSol(connection, accounts[k], minSol);
  }
}
/**
 * Function that's making sure that payer has enough funds to pay for the tx fees (estimated). Top up if not.
 * @param connection Connection to the cluster
 * @param payer Keypair of the payer
 */
export async function establishEnoughSol(
  connection: Connection,
  payer: Keypair
) {
  let fees = 0;
  // Calculate the cost of sending transactions
  fees += await feesEstimate(connection, payer);

  let [_, lamports] = await getBalance(connection, payer);
  if (lamports < fees) {
    await topUp(connection, payer, fees - lamports);
  }
}

/**
 * @private
 */
async function getConfig(): Promise<any> {
  // Path to Solana CLI config file
  const CONFIG_FILE_PATH = path.resolve(
    os.homedir(),
    ".config",
    "solana",
    "cli",
    "config.yml"
  );

  console.log("\nlocal system client config location: ", CONFIG_FILE_PATH);

  const configYml = await fs.readFile(CONFIG_FILE_PATH, { encoding: "utf8" });
  return yaml.parse(configYml);
}

/**
 * Load and parse the Solana CLI config file to determine which RPC url to use
 */
export async function getRpcUrl(): Promise<string> {
  try {
    const config = await getConfig();
    if (!config.json_rpc_url) throw new Error("Missing RPC URL");
    return config.json_rpc_url;
  } catch (err) {
    console.warn(
      "Failed to read RPC url from CLI config file, falling back to localhost"
    );
    return "http://localhost:8899";
  }
}

/**
 * Checks if provided account is executable and returns the public key
 */
export async function checkBinaryExists(
  PROGRAM_KEYPAIR_PATH: string
): Promise<PublicKey> {
  try {
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    return programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/helloworld.so\``
    );
  }
}

/**
 * Checks if provided account is executable
 */
export async function checkProgram(
  connection: Connection,
  accountID: PublicKey
) {
  const accountInfo = await connection.getAccountInfo(accountID);

  if (accountInfo) {
    if (accountInfo.executable) {
      return true;
    }
  }
  return false;
}

export async function loadKeypairsBatch(
  location: string = ""
): Promise<Keypair[]> {
  let keypairs: Keypair[] = [];
  for (let i = 1; i < 3; i++) {
    let file = `${location}${i}.json`;
    keypairs.push(await loadKeypair(file));
  }

  return keypairs;
}

export async function loadKeypair(location: string = ""): Promise<Keypair> {
  let load = await fs.readFile(location, {
    encoding: "utf8",
  });

  return Keypair.fromSeed(Uint8Array.from(Buffer.from(load).slice(0, 32)));
}
/**
 * Check if the particular programID is deployed to the network
 */
export async function checkAccountDeployed(
  connection: Connection,
  programId: PublicKey
): Promise<boolean> {
  const accountInfo = await connection.getAccountInfo(programId);
  if (accountInfo === null) {
    return false;
  } else {
    return true;
  }
}

/**
 * Load and parse the Solana CLI config file to determine which payer to use
 */
export async function getPayer(): Promise<Keypair> {
  try {
    const config = await getConfig();
    if (!config.keypair_path) throw new Error("Missing keypair path");
    return await createKeypairFromFile(config.keypair_path);
  } catch (err) {
    console.warn(
      "Failed to create keypair from CLI config file, falling back to new random keypair"
    );
    return Keypair.generate();
  }
}

/**
 * Create a Keypair from a secret key stored in file as bytes' array
 */
export async function createKeypairFromFile(
  filePath: string
): Promise<Keypair> {
  const secretKeyString = await fs.readFile(filePath, { encoding: "utf8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Function to get user's input from the CLI
 */
export async function getUserInput(
  text: string = "Input text"
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let user_input: string = "";

  console.log(text);

  for await (const ui of rl) {
    user_input = ui;

    rl.close();
  }

  return user_input;
}