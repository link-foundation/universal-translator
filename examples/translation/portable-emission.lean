inductive Packet where
  | item' : Nat → Packet

def unpack (p : Packet) : Nat :=
  match p with
  | Packet.item' n => n

theorem answer' : 2 + 2 = 4 := by decide

def main : IO Unit := do
  IO.println (unpack (Packet.item' (Int.toNat (-7))))
  IO.println (unpack (Packet.item' (Int.toNat 42)))
  IO.println "C:\\draft's"
