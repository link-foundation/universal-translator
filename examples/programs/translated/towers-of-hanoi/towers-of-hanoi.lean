-- Towers of Hanoi in Lean, solved recursively

partial def moveDisks (count : Int) (source : Int) (target : Int) (spare : Int) : IO Unit := do
  if count == 0 then
    return
  moveDisks (count - 1) source spare target
  IO.println s!"Move disk {count} from {source} to {target}"
  moveDisks (count - 1) spare target source

def main : IO Unit := do
  moveDisks 4 1 3 2
