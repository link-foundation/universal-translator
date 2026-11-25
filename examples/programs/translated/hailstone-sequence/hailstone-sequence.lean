-- Hailstone sequence in Lean: count the steps to reach 1

partial def hailstoneSteps (number : Int) : Int := Id.run do
  let mut number : Int := number
  let mut steps : Int := 0
  while number != 1 do
    if Int.tmod number 2 == 0 then
      number := Int.tdiv number 2
    else
      number := 3 * number + 1
    steps := steps + 1
  return steps

def main : IO Unit := do
  for number in (1 : Int)...<11 do
    IO.println s!"{number} takes {hailstoneSteps number} steps"
