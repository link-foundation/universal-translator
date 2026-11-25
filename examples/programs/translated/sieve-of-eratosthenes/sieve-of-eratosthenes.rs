// Sieve of Eratosthenes in Rust: the primes up to 100

fn main() {
    let limit: i64 = 100;
    let mut is_prime: Vec<i64> = vec![1; (limit + 1) as usize];
    is_prime[0] = 0;
    is_prime[1] = 0;
    for number in 2..limit + 1 {
        if is_prime[number as usize] == 1 {
            println!("{}", number);
            let mut multiple: i64 = number * number;
            while multiple <= limit {
                is_prime[multiple as usize] = 0;
                multiple += number;
            }
        }
    }
}
