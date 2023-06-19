/**
 * Counter
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import path from "path";
import * as borsh from "borsh";

import {
  getPayer,
  establishConnection,
  checkAccountDeployed,
  checkBinaryExists,
  getBalance,
  establishEnoughSol,
} from "../../../utils/utils";

// directory with binary and keypair
const PROGRAM_PATH = path.resolve(__dirname, "../../target/deploy/");

// Path to program shared object file which should be deployed on chain.
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, "counter.so");

// Path to the keypair of the deployed program (This file is created when running `solana program deploy)
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, "counter-keypair.json");

async function main() {
  console.log("Let's increment counter for an account!");

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

  if (await checkAccountDeployed(connection, programID)) {
    await deployGreetAccount(programID, connection, payer);

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

export async function deployGreetAccount(
  programId: PublicKey,
  connection: Connection,
  payer: Keypair
): Promise<void> {
  // Recreate structure for GreetingAccount
  const GreetingSchema = new Map([
    [GreetingAccount, { kind: "struct", fields: [["counter", "u32"]] }],
  ]);

  console.log("Program ID account: ", programId.toBase58());

  const GREETING_SEED = "hello_this_can_be_anything";
  let greetedPubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    GREETING_SEED,
    programId
  );

  // Deploy greeting account or increment counter within greetin account already deployed
  if (!(await checkAccountDeployed(connection, greetedPubkey))) {
    // size of an account based on serialisation
    const GREETING_SIZE = borsh.serialize(
      GreetingSchema,
      new GreetingAccount()
    ).length;

    console.log(`Account ${greetedPubkey} not deployed, deploying now`);
    console.log(
      "Creating account",
      greetedPubkey.toBase58(),
      "to say hello to"
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      GREETING_SIZE
    );
    //Creates transaction object with TransactionInstructions
    const txInstructions = SystemProgram.createAccountWithSeed({
      fromPubkey: payer.publicKey,
      basePubkey: payer.publicKey,
      // seeds are only used for PDA
      seed: GREETING_SEED,
      newAccountPubkey: greetedPubkey,
      lamports, // Minnimum money to be rent free
      space: GREETING_SIZE, // Size of the account
      programId, // Program owner of the this PDA
    });

    const transaction = new Transaction().add(txInstructions);
    // Submit transaction that creates account
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  } else {
    // Increment counter within already deployed greeting account
    console.log("Writing to the greeting counter", greetedPubkey.toBase58());
    const instruction = new TransactionInstruction({
      keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
      programId,
      data: Buffer.alloc(0), // All instructions are hellos
    });
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(instruction),
      [payer]
    );
  }
  // retrive the account from the network
  const accountInfo = await connection.getAccountInfo(greetedPubkey);
  if (accountInfo === null) {
    throw "Error: cannot find the greeted account";
  }
  // deserialize the account using known schema
  const greeting = borsh.deserialize(
    GreetingSchema,
    GreetingAccount,
    accountInfo.data
  );
  console.log(
    greetedPubkey.toBase58(),
    "has been greeted",
    greeting.counter,
    "time(s)"
  );
}

/**
 * The state of a greeting account managed by the hello world program
 */
class GreetingAccount {
  counter = 0;

  // constructor is for recosntructing it back from serialsied data
  constructor(fields: { counter: number } | undefined = undefined) {
    if (fields) {
      this.counter = fields.counter;
    }
  }
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);
