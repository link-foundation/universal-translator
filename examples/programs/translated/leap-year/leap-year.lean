-- Leap year in Lean

partial def isLeapYear (year : Int) : Bool := Id.run do
  return (Int.tmod year 4 == 0 && Int.tmod year 100 != 0) || Int.tmod year 400 == 0

def main : IO Unit := do
  for year in (1896 : Int)...<1913 do
    if isLeapYear year then
      IO.println s!"{year} is a leap year"
    else
      IO.println s!"{year} is not a leap year"
