-- Greatest element of a list in Lean

def main : IO Unit := do
  let numbers : Array Int := #[17, 4, 93, 28, 65, 3, 80]
  let mut greatest : Int := numbers[0]!
  for index in (0 : Int)...<Int.ofNat numbers.size do
    let number : Int := numbers[Int.toNat index]!
    if number > greatest then
      greatest := number
  IO.println s!"The greatest element is {greatest}"
