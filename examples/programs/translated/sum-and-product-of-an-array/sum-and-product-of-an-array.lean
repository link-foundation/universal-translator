-- Sum and product of an array in Lean

def main : IO Unit := do
  let numbers : Array Int := #[1, 2, 3, 4, 5]
  let mut total : Int := 0
  let mut product : Int := 1
  for index in (0 : Int)...<Int.ofNat numbers.size do
    total := total + numbers[Int.toNat index]!
    product := product * numbers[Int.toNat index]!
  IO.println s!"Sum: {total}"
  IO.println s!"Product: {product}"
