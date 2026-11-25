-- 99 bottles of beer in Lean

def main : IO Unit := do
  let mut bottles : Int := 99
  while bottles > 0 do
    IO.println s!"{bottles} bottles of beer on the wall, {bottles} bottles of beer."
    IO.println s!"Take one down and pass it around, {bottles - 1} bottles of beer on the wall."
    bottles := bottles - 1
