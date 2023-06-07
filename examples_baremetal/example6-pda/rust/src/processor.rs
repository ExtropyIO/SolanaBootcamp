use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, pubkey::Pubkey};

use crate::functions::{create_pda, write_pda};
use crate::instruction::Instruction;

pub struct Processor;
impl Processor {
    pub fn process_program_call(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        // turns bytecode into instrucion which contains function to invoke
        let instruction = Instruction::unpack(instruction_data)?;

        msg!("[processor] Received instruction struct: {:?}", instruction);

        match instruction {
            Instruction::PdaCreate {
                seed,
                bump,
                account_size,
            } => {
                create_pda(program_id, seed, bump, account_size, accounts)?;
            }
            Instruction::PdaWrite { seed } => {
                write_pda(program_id, seed, accounts)?;
            }
        }

        Ok(())
    }
}
