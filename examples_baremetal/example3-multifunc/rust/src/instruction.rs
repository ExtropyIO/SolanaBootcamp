use solana_program::{msg, program_error::ProgramError};

#[derive(Debug)]
pub enum Instruction {
    FunctionA,
    FunctionB,
}

// implement unpacking of the above enum
impl Instruction {
    /// Unpacks a byte buffer into an Instruction enum type
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // split into first element and the rest [element], [element array]
        let split = input.split_first();

        msg!("[instruction] Split");

        // process option
        let (function_flag, _rest) = split.ok_or({
            msg!("Message before the error");
            ProgramError::BorshIoError("Invalid parameters passed".to_string())
        })?;

        msg!("[instruction]Received function flag: {}", function_flag);


        // TODO now that we have unpacked our instructions we will use the function flag
        // to decide which function to call. 
        // If the function_flag is 0 pick the enum FunctionA, if it is 1 then FunctionB
        // otherwise return an error : 
        //  Err(ProgramError::BorshIoError("Invalid function flag".to_string(),))




    }
}
