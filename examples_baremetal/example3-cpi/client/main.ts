/**
 * Cross Program Invocation
 */
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import path from "path";

import {
  getPayer,
  establishConnection,
  checkAccountDeployed,
  checkBinaryExists,
  establishEnoughSol,
  getBalance,
} from "../../../utils/utils";

// directory with binary and keypair
const PROGRAM_PATH = path.resolve(__dirname, "../../target/deploy/");

// Path to program shared object file which should be deployed on chain.
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, "cpi.so");

// Path to the keypair of the deployed program (This file is created when running `solana program deploy)
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, "cpi-keypair.json");

async function main() {
  console.log("Let's invoke other program!");

  let payer: Keypair = await getPayer();

  // Establish connection to the cluster
  let connection: Connection = await establishConnection();

  await establishEnoughSol(connection, payer);

  // balance after top-up
  let [startBalanceSol, startBalanceLamport] = await getBalance(
    connection,
    payer
  );

  // Check if binary exists
  let programID = await checkBinaryExists(PROGRAM_KEYPAIR_PATH);

  // Check if deployed
  if (await checkAccountDeployed(connection, programID)) {
    await invoke(programID, connection, payer);

    // Print fees used up
    let [endBalanceSol, endBalanceLamport] = await getBalance(
      connection,
      payer
    );

    console.log(
      `\nIt cost:\n\t${startBalanceSol - endBalanceSol} SOL\n\t${
        startBalanceLamport - endBalanceLamport
      } Lamports\nto perform the call`
    );
  } else {
    console.log(`\nProgram ${PROGRAM_SO_PATH} not deployed!\n`);
  }
}

export async function invoke(
  programId: PublicKey,
  connection: Connection,
  payer: Keypair
): Promise<void> {
  // load key of the hello world
  let programIDHelloWorld = await checkBinaryExists(
    path.join(PROGRAM_PATH, "helloworld-keypair.json")
  );

  console.log("programIDHelloWorld: ", programIDHelloWorld.toBase58());

  const instruction = new TransactionInstruction({
    keys: [{ pubkey: programIDHelloWorld, isSigner: false, isWritable: false }],
    programId,
    data: Buffer.alloc(0), // Instruction data unnecessary to simply log output
  });

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer]
  );
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);
