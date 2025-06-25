use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
};

/// Define the type of state stored in accounts
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct StringAccount {
    pub word: String,
}

// finds valid account on-chain and creates it on-chain
pub fn create_pda(
    program_id: &Pubkey,
    seed: String,
    bump: u8,
    account_size: u8,
    accounts: &[AccountInfo],
) -> Result<(), ProgramError> {
    let mut accounts_iter = accounts.iter();
    let funder = next_account_info(&mut accounts_iter)?;
    let account_to_init = next_account_info(&mut accounts_iter)?;

    msg!(
        "[functions] {:?} will pay to initalise PDA at {:?}",
        funder.key,
        account_to_init.key
    );

    msg!(
        "The account has {} lamports",
        **account_to_init.try_borrow_lamports()?
    );
    if **account_to_init.try_borrow_lamports()? > 0 {
        msg!("This account is already initialised that account, skipping");
        return Ok(());
    }

    let lamports = Rent::default().minimum_balance(account_size as usize);

    // Account creation instruction
    let ix = solana_program::system_instruction::create_account(
        funder.key,
        account_to_init.key,
        lamports,
        account_size as u64,
        program_id,
    );

    msg!("[functions] PDA instruction created");

    // Sign and submit transaction
    invoke_signed(
        &ix,
        &[funder.clone(), account_to_init.clone()],
        &[&[seed.as_bytes(), &[bump]]],
    )?;

    msg!("[functions] PDA invoked");

    Ok(())
}

pub fn write_pda(
    program_id: &Pubkey,
    seed: String,
    accounts: &[AccountInfo],
) -> Result<(), ProgramError> {
    let accounts_iter = &mut accounts.iter();

    // Get the account to write the word to
    let account = next_account_info(accounts_iter)?;

    msg!("Word to save in an account: {:?}", seed);

    // Check PDA is owned by the program
    if account.owner != program_id {
        msg!("Word account does not have the correct program id");
        return Err(ProgramError::IncorrectProgramId);
    } else {
        msg!("Word account has the correct program id");
    }

    //

    // create struct from data under account using the template
    let mut word_account: StringAccount = BorshDeserialize::deserialize(&mut &account.data.borrow()[..])?;

    msg!(
        "Will attempt to serialise \"{:?}\" to account {:?}",
        seed,
        account.key
    );

    word_account.word = seed;

    // serialise and update the account
    word_account.serialize(&mut &mut account.data.borrow_mut()[..])?;

    msg!("Serialisation to PDA successful");

    Ok(())
}
