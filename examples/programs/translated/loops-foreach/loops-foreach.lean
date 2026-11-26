-- Loops/Foreach in Lean: print every element of a collection

def main : IO Unit := do
  let numbers : Array Int := #[1, 1, 2, 3, 5, 8, 13, 21]
  for index in (0 : Int)...<Int.ofNat numbers.size do
    let number : Int := numbers[Int.toNat index]!
    IO.println number
