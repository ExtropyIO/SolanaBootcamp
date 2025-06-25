/**
 * PDA
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
  getUserInput,
} from "../../../utils/utils";

// directory with binary and keypair
const PROGRAM_PATH = path.resolve(__dirname, "../../target/deploy/");

// Path to program shared object file which should be deployed on chain.
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, "pda.so");

// Path to the keypair of the deployed program (This file is created when running `solana program deploy)
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, "pda-keypair.json");

async function main() {
  console.log("Let's derive some accounts!");

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

  // Say hello to an account
  if (await checkAccountDeployed(connection, programID)) {
    const option = await getUserInput(
      // "Do you want to create PDA or write to PDA (c/w)?"
      "Pick option:\n\tCreate PDA:\t(1)\n\tWrite PDA:\t(2)\n\tRead PDA:\t(3)\n\tRead program accounts:\t(4)"
    );

    if (option == "1") {
      await createPDA(programID, connection, payer);
    } else if (option == "2") {
      await writePDA(programID, connection, payer);
    } else if (option == "3") {
      await readPDA(programID, connection, payer);
    } else {
      await getAllAccounts(programID, connection);
    }

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

export async function getAllAccounts(
  programId: PublicKey,
  connection: Connection
) {
  console.log(`\n${programId} owns:\n`);
  const programAccounts = await connection.getProgramAccounts(programId);

  for (let i = 0; i < programAccounts.length; i++){
    console.log(programAccounts[i].pubkey.toString());
  }  
}

// option to either call or write
export async function writePDA(
  programId: PublicKey,
  connection: Connection,
  payer: Keypair
): Promise<void> {
  const seed = await getUserInput(
    "\nProvide seed for the account to write to."
  );

  let seed_buffer = Buffer.from(seed);

  const [theAccountToWrite, bump] = await PublicKey.findProgramAddress(
    [seed_buffer],
    programId
  );

  console.log("theAccountToWrite: ", theAccountToWrite.toBase58());

  const word = await getUserInput("Type string to write to the account.");

  var instruction_set = Buffer.concat([
    Buffer.alloc(1, 1), // function flag for writing PDA
    Buffer.alloc(1, word.length), // length  of the word to write/store
    Buffer.from(word), // bytes of user specified word
  ]);

  // assembly of instruction
  const transaction = new TransactionInstruction({
    programId: programId,
    keys: [
      { pubkey: theAccountToWrite, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // first key payer

      // notice system program is gone as it is not invoked for writing
      // to an already owned account
    ],
    data: instruction_set,
  });

  // uses global variables
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(transaction),
    [payer]
  );
}

// option to either call or write
export async function createPDA(
  programId: PublicKey,
  connection: Connection,
  payer: Keypair
): Promise<void> {
  // compose call message

  // Get user input for the seed
  const seed = await getUserInput("\nPick seed for account generation.");
  const bytes = parseInt(await getUserInput("\nPick account size in bytes."));

  let seed_buffer = Buffer.from(seed);

  const [theAccountToInit, bump] = await PublicKey.findProgramAddress(
    [seed_buffer],
    programId
  );

  console.log(
    `\nDerived ${theAccountToInit.toBase58()} from ${seed} at ${bump} bump`
  );

  var instruction_set = Buffer.concat([
    Buffer.alloc(1, 0), // creating PDA
    Buffer.alloc(1, seed.length), // size of the seed (it varies)
    Buffer.from(seed), // seed buffer
    Buffer.alloc(1, bump), // bump integer
    Buffer.alloc(1, bytes), // acount size
  ]);

  console.log(`Instruction byte train to send: ${instruction_set}`);

  // assembly of instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true }, // first key payer
      { pubkey: theAccountToInit, isSigner: false, isWritable: true },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    programId,
    data: instruction_set,
  });
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payer]
  );
}

// option to either call or write
export async function readPDA(
  programId: PublicKey,
  connection: Connection,
  payer: Keypair
): Promise<void> {
  const WordSchema = new Map([
    [WordAccount, { kind: "struct", fields: [["word", "string"]] }],
  ]);

  const seed = await getUserInput("Provide seed for the account to read.");

  let seed_buffer = Buffer.from(seed);

  const [theAccountToRead, bump] = await PublicKey.findProgramAddress(
    [seed_buffer],
    programId
  );

  const accountInfo = await connection.getAccountInfo(theAccountToRead);
  if (accountInfo === null) {
    throw "Error: cannot find the greeted account";
  }
  const word_acc = borsh.deserializeUnchecked(
    WordSchema,
    WordAccount,
    accountInfo.data
  );
  console.log(`\n ${theAccountToRead.toBase58()} contains: ${word_acc.word}`);
}

/**
 * The state of a word account managed by the hello world program
 */
class WordAccount {
  word = "";
  constructor(fields: { word: string } | undefined = undefined) {
    if (fields) {
      this.word = fields.word;
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
