// functions3.rs
// Make me compile! Execute `rustlings hint functions3` for hints :)

fn main() {
    let num = 5; // Example: Call `call_this` with 5
    call_this(num);
}

fn call_this(num: u32) {
    for i in 0..num {
        println!("Loop now {}", i + 1);
    }
}
