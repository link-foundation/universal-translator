-- Bubble sort in Lean: sort a list of numbers

def main : IO Unit := do
  let mut numbers : Array Int := #[5, 3, 8, 1, 9, 2, 7]
  let count : Int := Int.ofNat numbers.size
  for pass in (0 : Int)...<count - 1 do
    for index in (0 : Int)...<count - 1 - pass do
      if numbers[Int.toNat index]! > numbers[Int.toNat (index + 1)]! then
        let swap : Int := numbers[Int.toNat index]!
        numbers := numbers.set! (Int.toNat index) numbers[Int.toNat (index + 1)]!
        numbers := numbers.set! (Int.toNat (index + 1)) swap
  for position in (0 : Int)...<count do
    IO.println numbers[Int.toNat position]!
