use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    instruction::Instruction,
    msg,
    program::invoke,
    pubkey::Pubkey,
};

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
pub fn process_instruction(
    _program_id: &Pubkey,     // Public key of the account (unused)
    accounts: &[AccountInfo], // Account/Program ID of the helloworld program
    _instruction_data: &[u8],
) -> ProgramResult {
    msg!("[entrypoint] CPI");

    // Get passed program ID of the helloworld
    let account_info_iter = &mut accounts.iter();
    let helloworld_account = next_account_info(account_info_iter)?;

    // assemble new instructions
    let inst = Instruction::new_with_bincode(*helloworld_account.key, &[0; 0], vec![]);

    msg!("[entrypoint] Calling helloworld");

    // invoke helloworld
    invoke(&inst, &[helloworld_account.clone()])?;

    Ok(())
}
