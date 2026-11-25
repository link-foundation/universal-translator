-- Ackermann function in Lean, defined recursively

partial def ackermann (first : Int) (second : Int) : Int := Id.run do
  if first == 0 then
    return second + 1
  if second == 0 then
    return ackermann (first - 1) 1
  return ackermann (first - 1) (ackermann first (second - 1))

def main : IO Unit := do
  for first in (0 : Int)...<4 do
    for second in (0 : Int)...<5 do
      IO.println s!"ackermann({first}, {second}) = {ackermann first second}"
