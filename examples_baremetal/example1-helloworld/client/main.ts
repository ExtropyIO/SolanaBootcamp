/**
 * Hello world
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

// utility functions that are wrappers of @solana/web3.js used throughout the project
import {
  getPayer,
  establishConnection,
  establishEnoughSol,
  checkAccountDeployed,
  checkBinaryExists,
  getBalance,
} from "../../../utils/utils";

// directory with binary and keypair
const PROGRAM_PATH = path.resolve(__dirname, "../../target/deploy/");

// Path to program shared object file which should be deployed on chain.
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, "helloworld.so");

// Path to the keypair of the deployed program (This file is created when running `solana program deploy)
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, "helloworld-keypair.json");

async function main() {
  // Get the payer for call
  let payer: Keypair = await getPayer();

  // Establish connection to the cluster
  let connection: Connection = await establishConnection();

  // Make sure payer has enough funds for fees and if not, top-up the account
  await establishEnoughSol(connection, payer);

  // Balance after top-up
  let [startBalanceSol, startBalanceLamport] = await getBalance(
    connection,
    payer
  );

  // Check if binary exists (ie if it's been compiled)
  let programID = await checkBinaryExists(PROGRAM_KEYPAIR_PATH);

  // Make sure the program is deployed
  if (await checkAccountDeployed(connection, programID)) {
    // Say hello to an account
    await sayHello(programID, connection, payer);

    // Print balances after the call
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
/**
 *
 * @param programId
 * @param connection
 * @param payer
 * @description Send a transaction to the program to say hello
 */
export async function sayHello(
  programId: PublicKey,
  connection: Connection,
  payer: Keypair
): Promise<void> {
  // Creates transaction instruction object to be passed to transaction
  const transactionInstruction = new TransactionInstruction({
    keys: [], // Keys unnecessary to simply log output
    programId: programId,
    data: Buffer.alloc(0), // Program instruction data unnecessary for this program
  });

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(transactionInstruction),
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
