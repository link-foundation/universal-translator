-- Linear search in Lean: find the position of a value in a list

def main : IO Unit := do
  let numbers : Array Int := #[31, 41, 59, 26, 53, 58, 97, 93]
  let wanted : Int := 53
  let mut position : Int := -1
  let mut current : Int := 0
  for index in (0 : Int)...<Int.ofNat numbers.size do
    let number : Int := numbers[Int.toNat index]!
    if number == wanted && position < 0 then
      position := current
    current := current + 1
  IO.println s!"Found {wanted} at position {position}"
