-- Sum multiples of 3 and 5 in Lean: the sum of the multiples below 1000

def main : IO Unit := do
  let mut total : Int := 0
  for number in (1 : Int)...<1000 do
    if Int.tmod number 3 == 0 || Int.tmod number 5 == 0 then
      total := total + number
  IO.println total
