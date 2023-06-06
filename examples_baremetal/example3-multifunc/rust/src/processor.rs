use solana_program::{account_info::AccountInfo, entrypoint::ProgramResult, msg, pubkey::Pubkey};

use crate::functions::{function_a, function_b};
use crate::instruction::Instruction;

pub struct Processor;
impl Processor {
    pub fn process_program_call(
        _program_id: &Pubkey,
        _accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        // turns bytecode into instrucion which contains function to invoke
        let instruction = Instruction::unpack(instruction_data)?;

        msg!("[processor] Received: {:?}", instruction);

        match instruction {
            Instruction::FunctionA => {
                function_a();
            }
            Instruction::FunctionB => {
                function_b();
            }
        }

        Ok(())
    }
}
