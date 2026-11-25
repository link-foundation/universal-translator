-- Mutual recursion in Lean: the Hofstadter Female and Male sequences

mutual
partial def female (index : Int) : Int := Id.run do
  if index == 0 then
    return 1
  return index - male (female (index - 1))

partial def male (index : Int) : Int := Id.run do
  if index == 0 then
    return 0
  return index - female (male (index - 1))
end

def main : IO Unit := do
  for index in (0 : Int)...<20 do
    IO.println s!"{index}: {female index} {male index}"
