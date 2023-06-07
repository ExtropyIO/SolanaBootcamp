use solana_program::{msg, program_error::ProgramError};
use std::str::from_utf8;

#[derive(Debug)]
pub enum Instruction {
    PdaCreate {
        seed: String,
        bump: u8,
        account_size: u8,
    },
    PdaWrite {
        seed: String,
    },
}

// implement unpacking of the above enum
impl Instruction {
    /// Unpacks a byte buffer into an Instruction enum type
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // split into first element and the rest [element], [element array]
        let split = input.split_first();

        msg!("[instruction] Total payload: {:?}", input);

        // process option  type
        let (function_flag, rest) = split.ok_or(ProgramError::BorshIoError(
            "Invalid parameters passed".to_string(),
        ))?;

        msg!("[instruction] Received function flag: {}", function_flag);

        // length of the string is fixed so it will be X first characters
        let (key_length, rest) = rest.split_first().ok_or(ProgramError::BorshIoError(
            "Invalid parameters passed".to_string(),
        ))?;

        // process function type
        match function_flag {
            0 => {
                msg!("[instruction] Initialising PDA");

                // Get seed from up to the key size as a string
                let seed = from_utf8(rest.get(..*key_length as usize).unwrap())
                    .unwrap()
                    .to_string();

                msg!("[instruction] extracted seed: {:?}", seed);

                // Get bump
                let bump = *rest.get(*key_length as usize).unwrap();

                msg!("[instruction] extracted bump: {:?}", bump);

                // Get account size in bytes
                let account_size = *rest.last().unwrap();

                msg!("[instruction] extracted account size: {:?}", account_size);

                Ok(Self::PdaCreate {
                    seed,
                    bump,
                    account_size,
                }) // needs seed and bump
            }

            1 => {
                msg!("[instruction] Writing to PDA");

                // Get seed from up to the key size
                let seed = from_utf8(rest.get(..*key_length as usize).unwrap())
                    .unwrap()
                    .to_string();

                Ok(Self::PdaWrite { seed })
            }
            _ => {
                return Err(ProgramError::BorshIoError(
                    "Invalid function flag".to_string(),
                ))
            }
        }
    }
}
